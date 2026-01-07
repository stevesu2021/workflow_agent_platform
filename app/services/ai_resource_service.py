from typing import List, Optional, Sequence, Dict, Any
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc
from app.models.ai_resource import AiResource
from app.schemas.ai_resource_schema import AiResourceCreate, AiResourceUpdate

class AiResourceService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_resources(self, type_filter: Optional[str] = None, only_enabled: bool = False) -> Sequence[AiResource]:
        query = select(AiResource)
        if type_filter:
            query = query.where(AiResource.type == type_filter)
        if only_enabled:
            query = query.where(AiResource.is_enabled == True)
        
        query = query.order_by(desc(AiResource.created_at))
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_resource(self, resource_id: uuid.UUID) -> Optional[AiResource]:
        return await self.session.get(AiResource, resource_id)

    async def create_resource(self, resource_create: AiResourceCreate) -> AiResource:
        resource = AiResource.from_orm(resource_create)
        
        # If this is the first resource of its type, make it default automatically?
        # Or if user requested is_default=True, unset others.
        if resource.is_default:
            await self._unset_other_defaults(resource.type)
            
        self.session.add(resource)
        await self.session.commit()
        await self.session.refresh(resource)
        return resource

    async def update_resource(self, resource_id: uuid.UUID, resource_update: AiResourceUpdate) -> Optional[AiResource]:
        resource = await self.get_resource(resource_id)
        if not resource:
            return None

        update_data = resource_update.dict(exclude_unset=True)
        
        # Handle default toggle logic
        if update_data.get("is_default") and not resource.is_default:
            # We are enabling default, so disable others of same type
            # Note: if type is also changed, we should use the new type
            target_type = update_data.get("type", resource.type)
            await self._unset_other_defaults(target_type)
        
        for key, value in update_data.items():
            setattr(resource, key, value)
            
        resource.updated_at = datetime.utcnow()
        self.session.add(resource)
        await self.session.commit()
        await self.session.refresh(resource)
        return resource

    async def delete_resource(self, resource_id: uuid.UUID) -> bool:
        resource = await self.get_resource(resource_id)
        if not resource:
            return False
        await self.session.delete(resource)
        await self.session.commit()
        return True

    async def _unset_other_defaults(self, resource_type: str, exclude_id: Optional[uuid.UUID] = None):
        # Unset is_default for all resources of this type
        query = select(AiResource).where(AiResource.type == resource_type).where(AiResource.is_default == True)
        if exclude_id:
            query = query.where(AiResource.id != exclude_id)
            
        result = await self.session.execute(query)
        resources = result.scalars().all()
        for res in resources:
            res.is_default = False
            self.session.add(res)
        # Note: We rely on the caller to commit

    async def set_default(self, resource_id: uuid.UUID) -> Optional[AiResource]:
        resource = await self.get_resource(resource_id)
        if not resource:
            return None
            
        if not resource.is_default:
            await self._unset_other_defaults(resource.type, exclude_id=resource.id)
            resource.is_default = True
            self.session.add(resource)
            await self.session.commit()
            await self.session.refresh(resource)
            
        return resource
        
    async def test_connection(self, resource: AiResource) -> dict:
        # Mock implementation for now. In real world, we'd use httpx to call the endpoint.
        import asyncio
        import random
        
        # Simulate network delay
        delay = random.uniform(0.1, 0.5)
        await asyncio.sleep(delay)
        
        # Simple mock logic based on type
        if "unknown" in resource.endpoint:
             return {
                "success": False,
                "message": "Failed to resolve host",
                "latency_ms": None
            }
            
        return {
            "success": True,
            "message": "Connected successfully",
            "latency_ms": round(delay * 1000, 2)
        }

    async def execute_test(self, resource: AiResource, payload: Dict[str, Any]) -> dict:
        """
        Execute a test call against the resource.
        """
        if resource.type == "ocr_paddle":
             return await self._test_paddleocr(resource, payload)

        import httpx
        
        headers = {
            "Content-Type": "application/json"
        }
        if resource.api_key:
            headers["Authorization"] = f"Bearer {resource.api_key}"
            
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    resource.endpoint, 
                    headers=headers,
                    json=payload
                )
                
                try:
                    response_data = response.json()
                except Exception:
                    response_data = response.text

                return {
                    "status": "success" if response.is_success else "error",
                    "status_code": response.status_code,
                    "resource_info": {
                        "name": resource.name,
                        "endpoint": resource.endpoint,
                        "type": resource.type
                    },
                    "response": response_data
                }
                
        except Exception as e:
            return {
                "status": "error",
                "message": f"Request failed: {str(e)}",
                "resource_info": {
                    "name": resource.name,
                    "endpoint": resource.endpoint,
                    "type": resource.type
                }
            }

    async def _test_paddleocr(self, resource: AiResource, payload: Dict[str, Any]) -> dict:
        import asyncio
        import json
        import os
        
        file_path = payload.get("file_path")
        if not file_path:
             # Use a default test file if available
             default_file = os.path.abspath("需求1.png")
             if os.path.exists(default_file):
                 file_path = default_file
             else:
                 return {
                    "status": "error", 
                    "message": "No test file provided and default '需求1.png' not found.",
                    "resource_info": {"name": resource.name}
                 }
        
        cmd = [
            "conda", "run", "-n", "paddleocr_vlm", "--no-capture-output",
            "python", "scripts/test_paddleocr_connection.py",
            "--server_url", resource.endpoint,
            "--file_path", file_path
        ]
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                 return {
                    "status": "error", 
                    "message": f"Script failed: {stderr.decode()}",
                    "resource_info": {"name": resource.name}
                 }
            
            try:
                result = json.loads(stdout.decode())
                return {
                    "status": "success" if result.get("status") == "success" else "error",
                    "response": result,
                    "resource_info": {
                        "name": resource.name,
                        "endpoint": resource.endpoint,
                        "type": resource.type
                    }
                }
            except json.JSONDecodeError:
                 return {
                    "status": "error",
                    "message": f"Invalid JSON output: {stdout.decode()}",
                    "resource_info": {"name": resource.name}
                 }

        except Exception as e:
            return {
                "status": "error", 
                "message": str(e),
                "resource_info": {"name": resource.name}
            }
