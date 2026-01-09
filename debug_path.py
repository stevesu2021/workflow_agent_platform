import sys
import os
print(f"CWD: {os.getcwd()}")
print(f"sys.path: {sys.path}")
try:
    import app
    print(f"app file: {app.__file__}")
    import app.services.vector_service as vs
    print(f"vector_service file: {vs.__file__}")
except Exception as e:
    print(f"Error importing: {e}")
