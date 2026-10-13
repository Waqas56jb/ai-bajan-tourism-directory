/** Global search across demo entities (listings, categories, locations, documents, FAQs, users). */
import { db } from './db';
import { simulate } from './mockApi';

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const globalSearch = (query, limitPerGroup = 4) =>
  simulate(
    () => {
      const q = norm(query).trim();
      if (q.length < 2) return [];
      const terms = q.split(/\s+/);
      const hit = (...fields) => {
        const text = norm(fields.join(' '));
        return terms.every((t) => text.includes(t));
      };
      const groups = [
        {
          type: 'Listings',
          items: db.listings
            .all()
            .filter((l) => hit(l.name, l.shortDescription, l.contact?.email))
            .map((l) => ({ id: l.id, title: l.name, subtitle: l.shortDescription, to: `/listings/${l.id}` })),
        },
        {
          type: 'Categories',
          items: db.categories
            .all()
            .filter((c) => hit(c.name, c.slug))
            .map((c) => ({
              id: c.id,
              title: c.name,
              subtitle: c.description,
              to: `/categories?view=${c.id}`,
            })),
        },
        {
          type: 'Locations',
          items: db.locations
            .all()
            .filter((l) => hit(l.name))
            .map((l) => ({
              id: l.id,
              title: l.name,
              subtitle: l.description,
              to: `/locations?view=${l.id}`,
            })),
        },
        {
          type: 'Knowledge documents',
          items: db.documents
            .all()
            .filter((d) => hit(d.title, d.summary))
            .map((d) => ({ id: d.id, title: d.title, subtitle: d.summary, to: `/knowledge/${d.id}` })),
        },
        {
          type: 'FAQs',
          items: db.faqs
            .all()
            .filter((f) => hit(f.question))
            .map((f) => ({
              id: f.id,
              title: f.question,
              subtitle: f.answer,
              to: `/knowledge/faqs?edit=${f.id}`,
            })),
        },
        {
          type: 'Users',
          items: db.users
            .all()
            .filter((u) => hit(u.name, u.email))
            .map((u) => ({ id: u.id, title: u.name, subtitle: u.email, to: `/users/${u.id}` })),
        },
      ];
      return groups
        .map((g) => ({ ...g, items: g.items.slice(0, limitPerGroup) }))
        .filter((g) => g.items.length);
    },
    { latency: 120 },
  );
