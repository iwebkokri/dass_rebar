// Widget registry: node type -> React component. To add a widget, declare it in lib/builder/schema.mjs (or lib/builder/defs/*.mjs)
// and add ONE line here.
import type { ComponentType } from 'react';
import type { WidgetProps } from '@/lib/builder/types';
import { Accordion, ButtonWidget, Counter, Divider, Heading, IconBox, IconWidget, ImageWidget, ListWidget, Logo, SocialIcons, Spacer, TextWidget } from './basic';
import { GalleryWidget, HtmlWidget, MapWidget, TemplateWidget, VideoWidget } from './media';
import HeroSlider from './HeroSlider';
import NavMenu from './NavMenu';
import { DYNAMIC_COMPONENTS } from './dynamic';

export const COMPONENTS: Record<string, ComponentType<WidgetProps>> = {
  heading: Heading,
  text: TextWidget,
  image: ImageWidget,
  button: ButtonWidget,
  spacer: Spacer,
  divider: Divider,
  icon: IconWidget,
  'icon-box': IconBox,
  list: ListWidget,
  counter: Counter,
  accordion: Accordion,
  'social-icons': SocialIcons,
  logo: Logo,
  video: VideoWidget,
  gallery: GalleryWidget,
  map: MapWidget,
  html: HtmlWidget,
  template: TemplateWidget,
  'hero-slider': HeroSlider,
  'nav-menu': NavMenu,
  // dynamic (CMS-driven) widgets are registered below by their own files:
  ...DYNAMIC_COMPONENTS, // projects, insights, products, bar-table, bar-diagrams, weight-calculator, quote-wizard, contact-form, newsletter, form
};
