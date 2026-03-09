# Fund Config — AUM & Inception

**Path:** `~/.dexter/fund-config.json`

Used for dollar-amount rebalance recommendations and since-inception performance.

## Schema

```json
{
  "aum": 2100000,
  "aum_tastytrade": 210000,
  "aum_hl": 210000,
  "inceptionDate": "2025-01-01"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `aum` | number | Total portfolio assets under management in dollars |
| `aum_tastytrade` | number | Tastytrade sleeve AUM in dollars |
| `aum_hl` | number | Hyperliquid sleeve AUM in dollars |
| `inceptionDate` | string | Inception date (YYYY-MM-DD) for since-inception returns |

## Setting via Dexter

```
Set my total AUM to $2,100,000, tastytrade sleeve AUM to $210,000, Hyperliquid sleeve AUM to $210,000, and inception date to 2025-01-01
```

Or use the fund_config tool directly (the agent will call it).

## Effect

- **Weekly rebalance (tastytrade):** When `aum_tastytrade` is set, the agent outputs main-sleeve dollar rebalance actions from that sleeve size instead of using total fund AUM. If `aum_tastytrade` is missing, it may fall back to `aum`.
- **Weekly rebalance (Hyperliquid):** When `aum_hl` is set, HL rebalance checks can output dollar-denominated trim/add actions for the HL sleeve.
- **Quarterly report:** When inceptionDate is set, the agent computes since-inception returns vs BTC, SPY, GLD
