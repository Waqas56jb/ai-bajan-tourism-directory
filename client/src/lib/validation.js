/**
 * Client-side validation schemas. These improve usability only — the server must validate
 * everything again.
 */
import { z } from 'zod';

export const contactTopics = [
  { value: 'general', label: 'General inquiry' },
  { value: 'listing', label: 'Business listing' },
  { value: 'advertising', label: 'Advertising' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'partnership', label: 'Partnership' },
];

const topicValues = contactTopics.map((t) => t.value);

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your name.')
    .max(100, 'Please keep your name under 100 characters.'),
  email: z
    .string()
    .trim()
    .min(1, 'Please enter your email address.')
    .email('Please enter a valid email address.'),
  topic: z.enum(topicValues, { errorMap: () => ({ message: 'Please choose an inquiry type.' }) }),
  subject: z
    .string()
    .trim()
    .min(3, 'Please add a short subject.')
    .max(140, 'Please keep the subject under 140 characters.'),
  message: z
    .string()
    .trim()
    .min(20, 'Please write at least 20 characters so we can help.')
    .max(4000, 'Please keep your message under 4,000 characters.'),
});

export const newsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Please enter your email address.')
    .email('Please enter a valid email address.'),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Please confirm you’d like to receive emails.' }),
  }),
});
