// Page-builder schema: node structure rules, the generic controls every node has, and the widget registry.
//
// Everything the editor needs is DECLARED here: the settings panel is generated from `controls`, the CSS from `css` rules on
// each control, and the server validates saved documents against the same definitions. No per-widget UI or CSS code.
//
// Document:  { v: 1, nodes: Node[] }            Node: { id, type, props, children? }
// Structure: section > row > column > (widget | row)

import { ICON_NAMES } from './icons.mjs';
import { DYNAMIC_WIDGETS } from './defs/dynamic.mjs';
import { o, ctl, typo, WEIGHTS } from './defs/helpers.mjs';

export const DEVICES = ['d', 't', 'm'];
export const DEVICE_LABEL = { d: 'Desktop', t: 'Tablet', m: 'Mobile' };
/** Max widths (px) of the tablet / mobile layouts. Desktop is the base. */
export const BREAKPOINTS = { t: 1024, m: 767 };

/** Brand swatches offered by every colour control. */
export const PALETTE = [
  ['#182845', 'Navy'], ['#7F5F47', 'Brown'], ['#6B4F3A', 'Dark brown'], ['#B0A18E', 'Tan'], ['#8D8E55', 'Olive'],
  ['#919CA4', 'Steel'], ['#DCDFE3', 'Light grey'], ['#F4F5F7', 'Off-white'], ['#FFFFFF', 'White'], ['#4A5568', 'Text grey'], ['#000000', 'Black'],
];

export const STRUCTURES = [[12], [6, 6], [4, 4, 4], [3, 3, 3, 3], [4, 8], [8, 4], [3, 6, 3], [2, 2, 2, 2, 2, 2]];

// ---- controls every node has -------------------------------------------------------------------------------------
const SHADOWS = o(
  ['', 'None'],
  ['0 4px 16px rgba(24,40,69,0.08)', 'Soft'],
  ['0 12px 32px rgba(24,40,69,0.12)', 'Medium'],
  ['0 24px 60px rgba(24,40,69,0.22)', 'Strong']
);

export const GENERIC_CONTROLS = [
  // Style
  ctl('dimensions', 'padding', 'Padding', { tab: 'style', group: 'Spacing', responsive: true, css: [{ prop: 'padding' }] }),
  ctl('dimensions', 'margin', 'Margin', { tab: 'style', group: 'Spacing', responsive: true, negative: true, css: [{ prop: 'margin' }] }),
  ctl('color', 'textColor', 'Text colour', { tab: 'style', group: 'Text', css: [{ prop: 'color' }] }),
  ctl('align', 'textAlign', 'Alignment', { tab: 'style', group: 'Text', responsive: true, css: [{ prop: 'text-align' }] }),
  ctl('color', 'bgColor', 'Colour', { tab: 'style', group: 'Background', css: [{ prop: 'background-color' }] }),
  ctl('text', 'bgGradient', 'Gradient (CSS)', { tab: 'style', group: 'Background', placeholder: 'linear-gradient(90deg, #182845, #7F5F47)', gradient: true, css: [{ prop: 'background-image' }] }),
  ctl('image', 'bgImage', 'Image', { tab: 'style', group: 'Background', css: [{ prop: 'background-image', tpl: 'url("{v}")' }] }),
  ctl('select', 'bgSize', 'Image size', { tab: 'style', group: 'Background', options: o(['', 'Default'], 'cover', 'contain', 'auto'), css: [{ prop: 'background-size' }], condition: { key: 'bgImage', truthy: true } }),
  ctl('select', 'bgPosition', 'Image position', { tab: 'style', group: 'Background', options: o(['', 'Default'], 'center', 'top', 'bottom', 'left', 'right'), css: [{ prop: 'background-position' }], condition: { key: 'bgImage', truthy: true } }),
  ctl('switch', 'bgFixed', 'Fixed (parallax)', { tab: 'style', group: 'Background', css: [{ prop: 'background-attachment', tpl: 'fixed' }], condition: { key: 'bgImage', truthy: true } }),
  ctl('color', 'overlay', 'Overlay colour', { tab: 'style', group: 'Background', for: ['section', 'column'], css: [{ sel: ' > .dr-bgl > .dr-ovl', prop: 'background' }], help: 'Use a semi-transparent colour, e.g. rgba(24,40,69,0.6)' }),
  ctl('text', 'overlayGradient', 'Overlay gradient (CSS)', { tab: 'style', group: 'Background', for: ['section', 'column'], placeholder: 'linear-gradient(90deg, rgba(24,40,69,0.95), rgba(24,40,69,0.45))', gradient: true, css: [{ sel: ' > .dr-bgl > .dr-ovl', prop: 'background' }], help: 'Needs an overlay colour above (used as the fallback); the gradient replaces it.', condition: { key: 'overlay', truthy: true } }),
  ctl('color', 'linkColor', 'Link colour', { tab: 'style', group: 'Text', css: [{ sel: ' a', prop: 'color' }] }),
  ctl('select', 'linkDecoration', 'Link underline', { tab: 'style', group: 'Text', options: o(['', 'Default'], ['none', 'No underline'], ['underline', 'Underline']), css: [{ sel: ' a', prop: 'text-decoration' }] }),
  ctl('video', 'bgVideo', 'Background video', { tab: 'style', group: 'Background', for: ['section'], help: 'Uploaded MP4/WebM. Plays muted, looped.' }),
  ctl('select', 'borderStyle', 'Border', { tab: 'style', group: 'Border', options: o(['', 'None'], 'solid', 'dashed', 'dotted'), css: [{ prop: 'border-style' }] }),
  ctl('dimensions', 'borderWidth', 'Border width', { tab: 'style', group: 'Border', responsive: true, css: [{ prop: 'border-width' }], condition: { key: 'borderStyle', truthy: true } }),
  ctl('color', 'borderColor', 'Border colour', { tab: 'style', group: 'Border', css: [{ prop: 'border-color' }], condition: { key: 'borderStyle', truthy: true } }),
  ctl('dimensions', 'radius', 'Corner radius', { tab: 'style', group: 'Border', responsive: true, css: [{ prop: 'border-radius' }] }),
  ctl('select', 'shadow', 'Shadow', { tab: 'style', group: 'Border', options: SHADOWS, css: [{ prop: 'box-shadow' }] }),
  ctl('number', 'opacity', 'Opacity', { tab: 'style', group: 'Effects', min: 0, max: 1, step: 0.05, css: [{ prop: 'opacity' }] }),
  ctl('size', 'width', 'Width', { tab: 'style', group: 'Size', responsive: true, units: ['px', '%', 'vw', 'auto'], not: ['section', 'row'], css: [{ prop: 'width' }] }),
  ctl('size', 'maxWidth', 'Max width', { tab: 'style', group: 'Size', responsive: true, units: ['px', '%', 'vw'], css: [{ prop: 'max-width' }] }),
  ctl('size', 'minHeight', 'Min height', { tab: 'style', group: 'Size', responsive: true, units: ['px', 'vh', '%'], css: [{ prop: 'min-height' }] }),
  ctl('select', 'aspect', 'Aspect ratio', { tab: 'style', group: 'Size', for: ['column'], options: o(['', 'Auto'], ['1 / 1', 'Square 1:1'], ['4 / 3', '4:3'], ['3 / 2', '3:2'], ['16 / 10', '16:10'], ['16 / 9', '16:9'], ['3 / 4', 'Portrait 3:4']), css: [{ prop: 'aspect-ratio' }] }),
  ctl('number', 'order', 'Order', { tab: 'advanced', group: 'Responsive', for: ['column'], responsive: true, min: -10, max: 10, step: 1, help: 'Changes the visual order of columns on a row, e.g. show an image first on mobile.', css: [{ prop: 'order' }] }),
  // Advanced
  ctl('multi', 'hideOn', 'Hide on', { tab: 'advanced', group: 'Responsive', options: o(['d', 'Desktop'], ['t', 'Tablet'], ['m', 'Mobile']) }),
  ctl('select', 'animation', 'Entrance animation', { tab: 'advanced', group: 'Motion', options: o(['', 'None'], ['fade', 'Fade in'], ['up', 'Fade up'], ['down', 'Fade down'], ['left', 'Slide from left'], ['right', 'Slide from right'], ['zoom', 'Zoom in']) }),
  ctl('number', 'animDelay', 'Delay (ms)', { tab: 'advanced', group: 'Motion', min: 0, max: 3000, step: 50, condition: { key: 'animation', truthy: true } }),
  ctl('text', 'anchor', 'Anchor ID', { tab: 'advanced', group: 'Attributes', help: 'Lets links jump here: add #your-id to a link.', pattern: /^[a-zA-Z][\w-]{0,60}$/ }),
  ctl('text', 'cssClass', 'CSS classes', { tab: 'advanced', group: 'Attributes', pattern: /^[\w\s-]{0,120}$/ }),
  ctl('textarea', 'customCss', 'Custom CSS', { tab: 'advanced', group: 'Attributes', custom: true, help: 'Use "selector" for this element, e.g. selector h2 { color: red }' }),
];

// ---- structural nodes --------------------------------------------------------------------------------------------
const STRUCTURAL = {
  section: {
    type: 'section', label: 'Section', icon: 'layers', category: 'layout', container: true,
    defaults: {},
    controls: [
      ctl('select', 'tag', 'HTML tag', { options: o('section', 'div', 'header', 'footer', 'main', 'article', 'aside'), default: 'section' }),
      ctl('select', 'contentMode', 'Content width', { options: o(['boxed', 'Boxed'], ['full', 'Full width']), default: 'boxed' }),
      ctl('size', 'boxWidth', 'Boxed width', { units: ['px', '%'], responsive: true, css: [{ sel: ' > .dr-inner', prop: 'max-width' }], condition: { key: 'contentMode', eq: 'boxed' } }),
      ctl('select', 'vAlign', 'Vertical align', { options: o(['', 'Top'], ['center', 'Middle'], ['flex-end', 'Bottom']), css: [{ prop: 'justify-content' }] }),
    ],
  },
  row: {
    type: 'row', label: 'Row', icon: 'grid', category: 'layout', container: true,
    defaults: {},
    controls: [
      ctl('size', 'gap', 'Gap', { responsive: true, units: ['px', 'rem'], css: [{ prop: '--gap' }, { prop: 'gap' }] }),
      ctl('select', 'rowAlign', 'Vertical align', { options: o(['', 'Stretch'], ['start', 'Top'], ['center', 'Middle'], ['end', 'Bottom']), css: [{ prop: 'align-items' }] }),
    ],
  },
  column: {
    type: 'column', label: 'Column', icon: 'grid', category: 'layout', container: true,
    defaults: { span: { d: 12, t: 12, m: 12 } },
    controls: [
      ctl('number', 'span', 'Width (of 12)', { responsive: true, min: 1, max: 12, step: 1, css: [{ prop: '--span', tpl: '{v}' }] }),
      ctl('select', 'direction', 'Direction', { options: o(['', 'Vertical'], ['row', 'Horizontal']), css: [{ prop: 'flex-direction' }] }),
      ctl('select', 'justify', 'Distribute', { responsive: true, options: o(['', 'Default'], ['flex-start', 'Start'], ['center', 'Centre'], ['flex-end', 'End'], ['space-between', 'Space between']), css: [{ prop: 'justify-content' }] }),
      ctl('select', 'colAlign', 'Align items', { options: o(['', 'Stretch'], ['flex-start', 'Start'], ['center', 'Centre'], ['flex-end', 'End']), css: [{ prop: 'align-items' }] }),
      ctl('size', 'gap', 'Gap', { responsive: true, units: ['px', 'rem'], css: [{ prop: 'gap' }] }),
      ctl('switch', 'wrap', 'Wrap', { css: [{ prop: 'flex-wrap', tpl: 'wrap' }] }),
    ],
  },
};

// ---- basic widgets -----------------------------------------------------------------------------------------------
const BASIC = [
  {
    type: 'heading', label: 'Heading', icon: 'pencil', category: 'basic',
    defaults: { text: 'Add your heading here', tag: 'h2' },
    controls: [
      ctl('textarea', 'text', 'Text', { inline: true }),
      ctl('select', 'tag', 'HTML tag', { options: o('h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'p', 'span'), default: 'h2' }),
      ctl('url', 'link', 'Link'),
      ctl('switch', 'newTab', 'Open in new tab', { condition: { key: 'link', truthy: true } }),
      ...typo('', ' .dr-heading'),
    ],
  },
  {
    type: 'text', label: 'Text', icon: 'pencil', category: 'basic',
    defaults: { html: '<p>Write your text here. Select it to make it bold, add a link or change the style.</p>' },
    controls: [
      ctl('rich', 'html', 'Text', { inline: true }),
      ...typo('', ' .dr-richtext'),
      ctl('size', 'paraGap', 'Paragraph spacing', { tab: 'style', group: 'Typography', units: ['px', 'em'], css: [{ sel: ' .dr-richtext > * + *', prop: 'margin-top' }] }),
    ],
  },
  {
    type: 'image', label: 'Image', icon: 'image', category: 'basic',
    defaults: { src: '', alt: '' },
    controls: [
      ctl('image', 'src', 'Image'),
      ctl('text', 'alt', 'Alt text', { help: 'Describe the image for screen readers and search engines.' }),
      ctl('url', 'link', 'Link'),
      ctl('switch', 'newTab', 'Open in new tab', { condition: { key: 'link', truthy: true } }),
      ctl('text', 'caption', 'Caption', { inline: true }),
      ctl('select', 'ratio', 'Aspect ratio', { tab: 'style', group: 'Image', options: o(['', 'Original'], ['1 / 1', 'Square 1:1'], ['4 / 3', '4:3'], ['3 / 2', '3:2'], ['16 / 9', '16:9'], ['5 / 4', '5:4'], ['3 / 4', 'Portrait 3:4']), css: [{ sel: ' img', prop: 'aspect-ratio' }] }),
      ctl('select', 'fit', 'Fit', { tab: 'style', group: 'Image', options: o(['cover', 'Cover'], ['contain', 'Contain'], ['fill', 'Stretch']), css: [{ sel: ' img', prop: 'object-fit' }] }),
      ctl('size', 'imgWidth', 'Image width', { tab: 'style', group: 'Image', responsive: true, units: ['px', '%'], css: [{ sel: ' img', prop: 'width' }] }),
      ctl('dimensions', 'imgRadius', 'Image corner radius', { tab: 'style', group: 'Image', css: [{ sel: ' img', prop: 'border-radius' }] }),
    ],
  },
  {
    type: 'button', label: 'Button', icon: 'cursor', category: 'basic',
    defaults: { label: 'Click here', url: '#', variant: 'solid', size: 'md' },
    controls: [
      ctl('text', 'label', 'Label', { inline: true }),
      ctl('url', 'url', 'Link'),
      ctl('switch', 'newTab', 'Open in new tab'),
      ctl('select', 'variant', 'Style', { options: o(['solid', 'Solid'], ['outline', 'Outline'], ['light', 'Light'], ['link', 'Text link']), default: 'solid' }),
      ctl('select', 'size', 'Size', { options: o(['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']), default: 'md' }),
      ctl('icon', 'icon', 'Icon after label'),
      ctl('switch', 'fullWidth', 'Full width'),
      ctl('color', 'btnColor', 'Text colour', { tab: 'style', group: 'Button', css: [{ sel: ' .dr-btn', prop: 'color' }] }),
      ctl('color', 'btnBg', 'Background', { tab: 'style', group: 'Button', css: [{ sel: ' .dr-btn', prop: 'background-color' }] }),
      ctl('color', 'btnBorder', 'Border colour', { tab: 'style', group: 'Button', css: [{ sel: ' .dr-btn', prop: 'border-color' }] }),
      ctl('dimensions', 'btnRadius', 'Corner radius', { tab: 'style', group: 'Button', css: [{ sel: ' .dr-btn', prop: 'border-radius' }] }),
      ctl('dimensions', 'btnPadding', 'Padding', { tab: 'style', group: 'Button', css: [{ sel: ' .dr-btn', prop: 'padding' }] }),
      ctl('size', 'btnFontSize', 'Font size', { tab: 'style', group: 'Button', units: ['px', 'rem'], css: [{ sel: ' .dr-btn', prop: 'font-size' }] }),
      ctl('select', 'btnWeight', 'Weight', { tab: 'style', group: 'Button', options: WEIGHTS, css: [{ sel: ' .dr-btn', prop: 'font-weight' }] }),
    ],
  },
  {
    type: 'spacer', label: 'Spacer', icon: 'arrows-v', category: 'basic',
    defaults: { height: { d: '40px' } },
    controls: [ctl('size', 'height', 'Height', { responsive: true, units: ['px', 'vh', 'rem'], css: [{ sel: ' .dr-spacer', prop: 'height' }] })],
  },
  {
    type: 'divider', label: 'Divider', icon: 'minus', category: 'basic',
    defaults: {},
    controls: [
      ctl('select', 'divStyle', 'Style', { options: o('solid', 'dashed', 'dotted'), css: [{ sel: ' hr', prop: 'border-top-style' }] }),
      ctl('size', 'divWeight', 'Weight', { units: ['px'], css: [{ sel: ' hr', prop: 'border-top-width' }] }),
      ctl('color', 'divColor', 'Colour', { css: [{ sel: ' hr', prop: 'border-top-color' }] }),
      ctl('size', 'divWidth', 'Width', { units: ['%', 'px'], css: [{ sel: ' hr', prop: 'width' }] }),
    ],
  },
  {
    type: 'icon', label: 'Icon', icon: 'star', category: 'basic',
    defaults: { icon: 'star' },
    controls: [
      ctl('icon', 'icon', 'Icon'),
      ctl('url', 'link', 'Link'),
      ctl('size', 'iconSize', 'Size', { tab: 'style', group: 'Icon', responsive: true, units: ['px'], css: [{ sel: ' svg', prop: 'width' }, { sel: ' svg', prop: 'height' }] }),
      ctl('color', 'iconColor', 'Colour', { tab: 'style', group: 'Icon', css: [{ sel: ' svg', prop: 'color' }] }),
    ],
  },
  {
    type: 'icon-box', label: 'Icon box', icon: 'grid', category: 'basic',
    defaults: { icon: 'check-circle', title: 'Feature title', text: 'Describe this feature in a sentence or two.', layout: 'top' },
    controls: [
      ctl('icon', 'icon', 'Icon'),
      ctl('text', 'title', 'Title', { inline: true }),
      ctl('textarea', 'text', 'Text', { inline: true }),
      ctl('url', 'link', 'Link (whole box)'),
      ctl('select', 'layout', 'Icon position', { options: o(['top', 'Top'], ['left', 'Left']), default: 'top' }),
      ctl('size', 'iconSize', 'Icon size', { tab: 'style', group: 'Icon', units: ['px'], css: [{ sel: ' .dr-ib-icon svg', prop: 'width' }, { sel: ' .dr-ib-icon svg', prop: 'height' }] }),
      ctl('color', 'iconColor', 'Icon colour', { tab: 'style', group: 'Icon', css: [{ sel: ' .dr-ib-icon', prop: 'color' }] }),
      ctl('size', 'ibGap', 'Gap', { tab: 'style', group: 'Icon', units: ['px'], css: [{ sel: ' .dr-ib', prop: 'gap' }] }),
      ctl('size', 'ibTextGap', 'Gap between title and text', { tab: 'style', group: 'Icon', units: ['px'], css: [{ sel: ' .dr-ib-body', prop: 'gap' }] }),
      ...typo('title', ' .dr-ib-title', 'Title'),
      ...typo('body', ' .dr-ib-text', 'Text'),
    ],
  },
  {
    type: 'list', label: 'List', icon: 'list', category: 'basic',
    defaults: { items: [{ text: 'First item' }, { text: 'Second item' }, { text: 'Third item' }], marker: 'check' },
    controls: [
      ctl('repeater', 'items', 'Items', { itemLabel: 'text', itemDefaults: { text: 'New item' }, fields: [ctl('text', 'text', 'Text', { inline: true })] }),
      ctl('select', 'marker', 'Marker', { options: o(['check', 'Check'], ['dot', 'Dot'], ['number', 'Numbers'], ['none', 'None']), default: 'check' }),
      ctl('color', 'markerColor', 'Marker colour', { tab: 'style', group: 'List', css: [{ sel: ' .dr-li-mark', prop: 'color' }] }),
      ctl('number', 'listCols', 'Columns', { tab: 'style', group: 'List', responsive: true, min: 1, max: 4, step: 1, css: [{ sel: ' .dr-list', prop: 'grid-template-columns', tpl: 'repeat({v}, minmax(0, 1fr))' }] }),
      ctl('size', 'listGap', 'Gap', { tab: 'style', group: 'List', units: ['px'], css: [{ sel: ' .dr-list', prop: 'gap' }] }),
      ...typo('', ' .dr-li'),
    ],
  },
  {
    type: 'counter', label: 'Stat / counter', icon: 'hash', category: 'basic',
    defaults: { number: '40', prefix: '', suffix: '+', label: 'Years of experience' },
    controls: [
      ctl('text', 'prefix', 'Prefix', { inline: true }),
      ctl('text', 'number', 'Number', { inline: true }),
      ctl('text', 'suffix', 'Suffix', { inline: true }),
      ctl('text', 'label', 'Label', { inline: true }),
      ...typo('num', ' .dr-num', 'Number'),
      ...typo('lbl', ' .dr-lbl', 'Label'),
    ],
  },
  {
    type: 'accordion', label: 'Accordion', icon: 'chevron-down', category: 'basic',
    defaults: { items: [{ title: 'Question one', body: 'Answer one.' }, { title: 'Question two', body: 'Answer two.' }], openFirst: true },
    controls: [
      ctl('repeater', 'items', 'Items', { itemLabel: 'title', itemDefaults: { title: 'New question', body: 'Answer.' }, fields: [ctl('text', 'title', 'Title', { inline: true }), ctl('textarea', 'body', 'Content', { inline: true })] }),
      ctl('switch', 'openFirst', 'First item open'),
      ctl('switch', 'faqSchema', 'Add FAQ structured data', { help: 'Tells Google and AI assistants these are real questions and answers (FAQPage). Use it only for genuine FAQs; every item needs an answer.' }),
      ctl('color', 'accBorder', 'Divider colour', { tab: 'style', group: 'Accordion', css: [{ sel: ' .dr-acc-item', prop: 'border-color' }] }),
      ...typo('title', ' .dr-acc-title', 'Title'),
      ...typo('body', ' .dr-acc-body', 'Content'),
    ],
  },
  {
    type: 'social-icons', label: 'Social icons', icon: 'globe', category: 'basic',
    defaults: { items: [{ network: 'linkedin', url: '#' }, { network: 'instagram', url: '#' }, { network: 'facebook', url: '#' }] },
    controls: [
      ctl('repeater', 'items', 'Networks', { itemLabel: 'network', itemDefaults: { network: 'linkedin', url: '' }, fields: [ctl('select', 'network', 'Network', { options: o('linkedin', 'instagram', 'facebook', 'x', 'youtube', 'mail', 'phone', 'globe') }), ctl('url', 'url', 'URL')] }),
      ctl('size', 'btnSize', 'Button size', { tab: 'style', group: 'Icons', units: ['px'], css: [{ sel: ' .dr-soc a', prop: 'width' }, { sel: ' .dr-soc a', prop: 'height' }] }),
      ctl('color', 'socColor', 'Colour', { tab: 'style', group: 'Icons', css: [{ sel: ' .dr-soc a', prop: 'color' }] }),
      ctl('color', 'socBorder', 'Border colour', { tab: 'style', group: 'Icons', css: [{ sel: ' .dr-soc a', prop: 'border-color' }] }),
      ctl('size', 'socGap', 'Gap', { tab: 'style', group: 'Icons', units: ['px'], css: [{ sel: ' .dr-soc', prop: 'gap' }] }),
    ],
  },
];

// ---- media widgets -----------------------------------------------------------------------------------------------
const MEDIA = [
  {
    type: 'video', label: 'Video', icon: 'play', category: 'media',
    defaults: { source: 'youtube', url: '', ratio: '16 / 9', controls: true },
    controls: [
      ctl('select', 'source', 'Source', { options: o(['youtube', 'YouTube'], ['vimeo', 'Vimeo'], ['file', 'Uploaded / direct file']), default: 'youtube' }),
      ctl('text', 'url', 'Video link', { condition: { key: 'source', in: ['youtube', 'vimeo'] }, placeholder: 'https://www.youtube.com/watch?v=…' }),
      ctl('video', 'src', 'Video file', { condition: { key: 'source', eq: 'file' } }),
      ctl('image', 'poster', 'Cover image', { condition: { key: 'source', eq: 'file' } }),
      ctl('switch', 'autoplay', 'Autoplay (muted)', { condition: { key: 'source', eq: 'file' } }),
      ctl('switch', 'loop', 'Loop', { condition: { key: 'source', eq: 'file' } }),
      ctl('switch', 'controls', 'Show controls', { condition: { key: 'source', eq: 'file' } }),
      ctl('select', 'ratio', 'Aspect ratio', { tab: 'style', group: 'Video', options: o(['16 / 9', '16:9'], ['4 / 3', '4:3'], ['1 / 1', '1:1'], ['21 / 9', '21:9'], ['9 / 16', 'Vertical 9:16']), css: [{ sel: ' .dr-video', prop: 'aspect-ratio' }] }),
    ],
  },
  {
    type: 'gallery', label: 'Image gallery', icon: 'image', category: 'media',
    defaults: { images: [], cols: { d: 3, t: 2, m: 1 }, lightbox: true },
    controls: [
      ctl('repeater', 'images', 'Images', { itemLabel: 'alt', itemDefaults: { src: '', alt: '' }, fields: [ctl('image', 'src', 'Image'), ctl('text', 'alt', 'Alt text')] }),
      ctl('number', 'cols', 'Columns', { responsive: true, min: 1, max: 6, step: 1, css: [{ sel: ' .dr-gal', prop: 'grid-template-columns', tpl: 'repeat({v}, minmax(0, 1fr))' }] }),
      ctl('size', 'galGap', 'Gap', { responsive: true, units: ['px'], css: [{ sel: ' .dr-gal', prop: 'gap' }] }),
      ctl('select', 'galRatio', 'Aspect ratio', { options: o(['4 / 3', '4:3'], ['1 / 1', 'Square'], ['3 / 2', '3:2'], ['16 / 9', '16:9'], ['', 'Original']), css: [{ sel: ' .dr-gal img', prop: 'aspect-ratio' }] }),
      ctl('dimensions', 'galRadius', 'Corner radius', { tab: 'style', group: 'Gallery', css: [{ sel: ' .dr-gal img', prop: 'border-radius' }] }),
      ctl('switch', 'lightbox', 'Open images in a lightbox'),
    ],
  },
  {
    type: 'hero-slider', label: 'Hero slider', icon: 'image', category: 'media',
    defaults: {
      autoplay: true, interval: 6500,
      slides: [{ image: '', tab: 'Slide one', eyebrow: 'EYEBROW TEXT', heading: 'Slide headline', text: 'A short supporting sentence.', btn1Label: 'Learn more', btn1Url: '#', btn2Label: '', btn2Url: '' }],
    },
    controls: [
      ctl('repeater', 'slides', 'Slides', {
        itemLabel: 'tab',
        itemDefaults: { image: '', tab: 'New slide', eyebrow: '', heading: 'Slide headline', text: '', btn1Label: '', btn1Url: '', btn2Label: '', btn2Url: '' },
        fields: [
          ctl('image', 'image', 'Background image'), ctl('text', 'tab', 'Tab label', { inline: true }), ctl('text', 'eyebrow', 'Eyebrow', { inline: true }),
          ctl('text', 'heading', 'Heading', { inline: true }), ctl('textarea', 'text', 'Text', { inline: true }),
          ctl('text', 'btn1Label', 'Button 1 label', { inline: true }), ctl('url', 'btn1Url', 'Button 1 link'),
          ctl('text', 'btn2Label', 'Button 2 label', { inline: true }), ctl('url', 'btn2Url', 'Button 2 link'),
        ],
      }),
      ctl('switch', 'autoplay', 'Autoplay'),
      ctl('number', 'interval', 'Seconds per slide (ms)', { min: 2000, max: 20000, step: 500, condition: { key: 'autoplay', truthy: true } }),
      ctl('size', 'heroHeight', 'Height', { tab: 'style', group: 'Slider', responsive: true, units: ['px', 'vh'], css: [{ sel: ' .dr-hs', prop: 'height' }] }),
      ctl('color', 'heroOverlay', 'Overlay colour', { tab: 'style', group: 'Slider', css: [{ sel: ' .dr-hs-ovl', prop: 'background' }], help: 'e.g. linear-gradient is not supported here; use rgba(24,40,69,0.6)' }),
    ],
  },
  {
    type: 'map', label: 'Google map', icon: 'map-pin', category: 'media',
    defaults: { query: '370 New Enterprise Way, Vaughan, ON', zoom: 14 },
    controls: [
      ctl('text', 'query', 'Address or place'),
      ctl('number', 'zoom', 'Zoom', { min: 1, max: 20, step: 1, default: 14 }),
      ctl('size', 'mapHeight', 'Height', { tab: 'style', group: 'Map', responsive: true, units: ['px', 'vh'], css: [{ sel: ' iframe', prop: 'height' }] }),
    ],
  },
  {
    type: 'html', label: 'Custom HTML', icon: 'code', category: 'media', adminOnly: true,
    defaults: { code: '<!-- Paste an embed code or your own HTML here -->' },
    controls: [ctl('textarea', 'code', 'HTML', { code: true, help: 'Administrators only. Scripts run on the live site, so paste only code you trust.' })],
  },
];

// ---- site / reusable ---------------------------------------------------------------------------------------------
const SITE = [
  {
    type: 'template', label: 'Saved section', icon: 'layers', category: 'site',
    defaults: { templateId: '' },
    needs: ['templates'],
    controls: [ctl('resource', 'templateId', 'Saved section', { source: 'sections', help: 'A live link: edit the saved section once and every page using it updates.' })],
  },
];

const all = [...BASIC, ...MEDIA, ...DYNAMIC_WIDGETS, ...SITE];

/** type -> widget definition (including section / row / column). */
export const WIDGETS = Object.fromEntries([...Object.values(STRUCTURAL), ...all].map((w) => [w.type, w]));

export const ROOT_TYPES = ['section'];
export const CHILD_TYPES = {
  section: ['row'],
  row: ['column'],
  column: ['row', ...all.map((w) => w.type)],
};
for (const w of all) CHILD_TYPES[w.type] = [];

export const CATEGORIES = [
  ['basic', 'Basic'], ['media', 'Media'], ['dynamic', 'Dynamic content'], ['site', 'Site'],
];

export const isWidget = (type) => !!WIDGETS[type] && !STRUCTURAL[type];

export function appliesTo(control, type) {
  if (control.for && !control.for.includes(type)) return false;
  if (control.not && control.not.includes(type)) return false;
  return true;
}

/** All controls for a node type: its own + the generic ones. */
export function controlsFor(type) {
  const def = WIDGETS[type];
  if (!def) return [];
  return [...def.controls, ...GENERIC_CONTROLS.filter((c) => appliesTo(c, type))];
}

/** Is `v` a per-device map ({ d, t, m }) for this control? (Dimension values use t/r/b/l too, so look at what the values are.) */
export function isDeviceMap(control, v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  if (control.kind === 'dimensions') return ['d', 't', 'm'].some((k) => v[k] && typeof v[k] === 'object');
  return ['d', 't', 'm'].some((k) => k in v);
}

export function defaultProps(type) {
  const def = WIDGETS[type];
  const props = {};
  for (const c of def?.controls ?? []) if (c.default !== undefined) props[c.key] = c.default;
  return { ...props, ...JSON.parse(JSON.stringify(def?.defaults ?? {})) };
}

/** Current value of a prop, falling back to the control default. */
export function propValue(node, key) {
  if (node.props && node.props[key] !== undefined) return node.props[key];
  const c = controlsFor(node.type).find((x) => x.key === key);
  return c?.default;
}

export { ICON_NAMES };
