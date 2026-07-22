"""
app/core/rbac.py
================
Role-Based Access Control (RBAC) helpers and FastAPI dependencies.
"""
from typing import List
from fastapi import Depends, HTTPException, status
from app.core.models import SessionContext
from app.core.dependencies import require_authenticated

def require_role(*roles: str):
    """
    Dependency factory to restrict route access to specific roles.
    Example: Depends(require_role("admin", "accountant"))
    """
    def _role_checker(context: SessionContext = Depends(require_authenticated)) -> SessionContext:
        if context.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role in: {list(roles)}. Current role: '{context.role}'"
            )
        return context
    return _role_checker


def require_permission(permission: str):
    """
    Dependency factory to check if the authenticated user has a specific permission.
    Example: Depends(require_permission("dashboard:read"))
    """
    def _permission_checker(context: SessionContext = Depends(require_authenticated)) -> SessionContext:
        # admin or super_admin gets wildcard bypass
        if context.role in ["admin", "super_admin"] or "*" in context.permissions:
            return context
            
        has_perm = False
        if isinstance(context.permissions, dict):
            parts = permission.split(":")
            if len(parts) == 2:
                module, action = parts[0], parts[1]
                mod_perms = context.permissions.get(module)
                if isinstance(mod_perms, dict):
                    # Check action or map legacy synonyms if checked
                    has_perm = mod_perms.get(action, False)
        elif isinstance(context.permissions, list):
            has_perm = permission in context.permissions

        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Missing required permission: '{permission}'"
            )
        return context
    return _permission_checker

