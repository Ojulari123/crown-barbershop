from fastapi import HTTPException


def fail(status: int, code: str, message: str) -> HTTPException:
    """App error in the contract envelope: {"detail": {"code", "message"}} (decisions D20)."""
    return HTTPException(status_code=status, detail={"code": code, "message": message})
