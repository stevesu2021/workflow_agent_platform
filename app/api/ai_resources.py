import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.schemas.ai_resource_schema import (
    AiResourceCreate, 
    AiResourceUpdate, 
    AiResourceResponse, 
    AiResourceListResponse,
    TestConnectionResponse
)
from app.services.ai_resource_service import AiResourceService

router = APIRouter()

@router.get("/available", response_model=dict)
async def get_available_resources(
    type: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
):
    """
    Get all available (enabled) resources, optionally filtered by type.
    This is for the Workflow Node selection.
    """
    service = AiResourceService(session)
    resources = await service.list_resources(type_filter=type, only_enabled=True)
    
    return {
        "data": [
            AiResourceListResponse(
                id=r.id,
                name=r.name,
                type=r.type,
                is_default=r.is_default,
                is_enabled=r.is_enabled,
                description=r.description,
                health_status=r.health_status
            ) for r in resources
        ]
    }

@router.get("/", response_model=List[AiResourceResponse])
async def list_all_resources(
    session: AsyncSession = Depends(get_session)
):
    """
    Get all resources (including disabled ones) for the Settings page.
    """
    service = AiResourceService(session)
    resources = await service.list_resources()
    
    # We might want to mask the API key here
    results = []
    for r in resources:
        res_dict = r.dict()
        if res_dict.get('api_key'):
            res_dict['api_key'] = "sk-***" + res_dict['api_key'][-4:] if len(res_dict['api_key']) > 4 else "***"
        results.append(AiResourceResponse(**res_dict))
        
    return results

@router.post("/", response_model=AiResourceResponse)
async def create_resource(
    resource: AiResourceCreate,
    session: AsyncSession = Depends(get_session)
):
    service = AiResourceService(session)
    new_resource = await service.create_resource(resource)
    return new_resource

@router.put("/{resource_id}", response_model=AiResourceResponse)
async def update_resource(
    resource_id: uuid.UUID,
    resource: AiResourceUpdate,
    session: AsyncSession = Depends(get_session)
):
    service = AiResourceService(session)
    updated_resource = await service.update_resource(resource_id, resource)
    if not updated_resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return updated_resource

@router.delete("/{resource_id}")
async def delete_resource(
    resource_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    service = AiResourceService(session)
    success = await service.delete_resource(resource_id)
    if not success:
        raise HTTPException(status_code=404, detail="Resource not found")
    return {"message": "Resource deleted successfully"}

@router.post("/{resource_id}/test-connection", response_model=TestConnectionResponse)
async def test_connection(
    resource_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    service = AiResourceService(session)
    resource = await service.get_resource(resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    result = await service.test_connection(resource)
    
    # Update health status based on result
    resource_update = AiResourceUpdate(
        health_status="healthy" if result["success"] else "unhealthy"
    )
    await service.update_resource(resource_id, resource_update)
    
    return TestConnectionResponse(**result)

@router.post("/set-default")
async def set_default_resource(
    body: dict = Body(...),
    session: AsyncSession = Depends(get_session)
):
    resource_id_str = body.get("resource_id")
    if not resource_id_str:
        raise HTTPException(status_code=400, detail="resource_id is required")
        
    try:
        resource_id = uuid.UUID(resource_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")
        
    service = AiResourceService(session)
    resource = await service.set_default(resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    return {"message": "Default resource set successfully"}

@router.post("/{resource_id}/test", response_model=dict)
async def test_resource_execution(
    resource_id: uuid.UUID,
    payload: dict = Body(...),
    session: AsyncSession = Depends(get_session)
):
    """
    Execute a test call against the resource.
    """
    service = AiResourceService(session)
    resource = await service.get_resource(resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    result = await service.execute_test(resource, payload)
    return result
