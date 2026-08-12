# CSS Custom Properties API

This package uses the following convention:

- Public, supported tokens: `--lc-*`
- Internal implementation tokens: `--_lc-*` (private, not stable)

## Shared / timeline surface

Common public tokens consumed by `calendar-timeline-view`, `event-card`, and related chrome:

- `--lc-higlight-color`
- `--lc-grid-base-color`
- `--lc-event-card-radius`
- `--lc-weekend-day-label-color`

## Notes

- `--_lc-*` tokens are private plumbing for layout/drag math and may change at any time.
- Only rely on `--lc-*` tokens from outside the components.
