// Example popups (kind 'popup'). They are written SWITCHED OFF (active 0 → "Draft" in Admin → Popups): nothing changes on the live
// site until someone opens one, adjusts it and presses Activate. `npm run seed` only adds the ones that are missing by name.
import { POPUP_PRESETS } from '../popup-presets.mjs';

const make = (id, name, extra = {}) => ({
  kind: 'popup',
  name,
  content: POPUP_PRESETS[id].content({}),
  settings: { ...POPUP_PRESETS[id].settings, ...extra },
});

export default [
  make('newsletter', 'Example: Newsletter signup', { slug: 'example-newsletter' }),
  make('announcement', 'Example: Announcement bar', { slug: 'example-announcement' }),
  make('exit', 'Example: Exit-intent offer', { slug: 'example-exit-offer' }),
];
