from pydantic import BaseModel


class OTStatusCount(BaseModel):
    status: str
    count: int


class MonthlyRevenue(BaseModel):
    month: str
    total: float


class DashboardSummary(BaseModel):
    active_ots: int
    pending_quotations: int
    monthly_revenue: float
    approval_rate: float
    ot_by_status: list[OTStatusCount]
    monthly_revenue_chart: list[MonthlyRevenue]
    recent_ots: list[dict]
