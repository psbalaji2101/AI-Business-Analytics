"""AI assistant router — natural-language Q&A over analytics.

Scaffold: endpoint wired to the LLM provider; question->query mapping lands in Phase 6.
"""
from fastapi import APIRouter, Depends

from app.ai.factory import get_llm
from app.api.deps import get_current_user
from app.schemas.analytics import AskRequest, AskResponse

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(get_current_user)])


@router.post("/ask", response_model=AskResponse)
async def ask(payload: AskRequest) -> AskResponse:
    llm = get_llm()
    # TODO(Phase 6): map question -> structured analytics query, feed facts to the LLM.
    answer = await llm.complete(
        f"You asked: {payload.question}. Analytics-backed answers arrive in Phase 6."
    )
    return AskResponse(answer=answer)
