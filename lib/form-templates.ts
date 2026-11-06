// Starter templates for "New form" (client-safe). Picking one pre-fills the builder; nothing is saved until "Create form".
import type { FormField } from './builder/types';
import type { FormSettings } from './forms-shared';

export type FormTemplate = {
  id: string;
  label: string;
  description: string;
  name: string;
  fields: FormField[];
  settings: Partial<FormSettings>;
};

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'contact',
    label: 'Contact',
    description: 'Name, email, phone and a message — the classic “get in touch” form.',
    name: 'Contact form',
    fields: [
      { id: 'name', type: 'text', label: 'Name', required: true, width: 'half' },
      { id: 'email', type: 'email', label: 'Email', required: true, width: 'half', contact: true },
      { id: 'phone', type: 'tel', label: 'Phone', width: 'half' },
      { id: 'company', type: 'text', label: 'Company', width: 'half' },
      { id: 'message', type: 'textarea', label: 'How can we help?', required: true, width: 'full' },
    ],
    settings: { submitLabel: 'Send message', successMessage: 'Thank you — we have your message and will reply shortly.' },
  },
  {
    id: 'quote',
    label: 'Quote request',
    description: 'Project details, timing and drawings — for estimating requests.',
    name: 'Quote request',
    fields: [
      { id: 'name', type: 'text', label: 'Name', required: true, width: 'half' },
      { id: 'email', type: 'email', label: 'Email', required: true, width: 'half', contact: true },
      { id: 'phone', type: 'tel', label: 'Phone', required: true, width: 'half' },
      { id: 'company', type: 'text', label: 'Company', width: 'half' },
      { id: 'project_location', type: 'text', label: 'Project location', required: true, width: 'half' },
      { id: 'required_by', type: 'date', label: 'Material needed by', width: 'half' },
      { id: 'work_type', type: 'select', label: 'What do you need?', required: true, width: 'full', options: ['Supply only', 'Fabrication (cut & bend)', 'Supply and fabrication', 'Not sure yet'] },
      { id: 'details', type: 'textarea', label: 'Project details', required: true, width: 'full', placeholder: 'Bar sizes, quantities, delivery address …' },
      { id: 'drawings', type: 'file', label: 'Drawings / bar list (optional)', width: 'full', help: 'PDF, DWG, DXF, Excel or images — up to 10 MB each.' },
    ],
    settings: { submitLabel: 'Request a quote', successMessage: 'Thank you — our estimating team will review your request and get back to you.' },
  },
  {
    id: 'callback',
    label: 'Callback request',
    description: 'Just a name, a number and the best time to call.',
    name: 'Callback request',
    fields: [
      { id: 'name', type: 'text', label: 'Name', required: true, width: 'half' },
      { id: 'phone', type: 'tel', label: 'Phone', required: true, width: 'half' },
      { id: 'best_time', type: 'radio', label: 'Best time to call', required: true, width: 'full', options: ['Morning', 'Afternoon', 'Evening'] },
      { id: 'email', type: 'email', label: 'Email (optional)', width: 'full', contact: true },
    ],
    settings: { submitLabel: 'Call me back', successMessage: 'Thanks — we will call you back at your preferred time.' },
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'One email field and a consent tick — ideal for a popup.',
    name: 'Newsletter signup',
    fields: [
      { id: 'email', type: 'email', label: 'Email', required: true, width: 'full', contact: true, placeholder: 'you@example.com' },
      { id: 'consent', type: 'consent', label: 'I agree to receive updates by email. I can unsubscribe at any time.', required: true, width: 'full' },
    ],
    settings: { submitLabel: 'Subscribe', successMessage: 'Thanks — you are subscribed.' },
  },
  {
    id: 'feedback',
    label: 'Feedback',
    description: 'A rating and a few words from the customer.',
    name: 'Feedback',
    fields: [
      { id: 'name', type: 'text', label: 'Name', width: 'half' },
      { id: 'email', type: 'email', label: 'Email', width: 'half', contact: true },
      { id: 'rating', type: 'radio', label: 'How was your experience?', required: true, width: 'full', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
      { id: 'comments', type: 'textarea', label: 'Comments', required: true, width: 'full' },
    ],
    settings: { submitLabel: 'Send feedback', successMessage: 'Thank you for your feedback.' },
  },
  {
    id: 'blank',
    label: 'Blank',
    description: 'Start from scratch and add your own fields.',
    name: '',
    fields: [],
    settings: {},
  },
];

export const templateById = (id: string | undefined) => FORM_TEMPLATES.find((t) => t.id === id);
