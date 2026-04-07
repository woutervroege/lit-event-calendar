# CSS Custom Properties API

This package uses the following convention:

- Public, supported tokens: `--lc-*`
- Internal implementation tokens: `--_lc-*` (private, not stable)

## CalendarGridView (`calendar-grid-view`)

- `--lc-higlight-color`
- `--lc-event-height`
- `--lc-days-per-row`
- `--lc-grid-base-color`

## Notes

- `--_lc-*` tokens are private plumbing for layout/drag math and may change at any time.
- Only rely on `--lc-*` tokens from outside the components.
