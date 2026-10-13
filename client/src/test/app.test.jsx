import { describe, expect, it } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, renderWithProviders } from './utils';
import { RatingDisplay } from '@/components/common/RatingDisplay';
import NewsletterForm from '@/components/forms/NewsletterForm';

describe('homepage', () => {
  it('renders the hero, search and key sections', async () => {
    renderApp('/');
    expect(
      screen.getByRole('heading', { level: 1, name: /ask barbados. get a bajan answer/i }),
    ).toBeInTheDocument();
    // One prominent question box leads the page; the directory search is a secondary section.
    expect(screen.getByRole('search', { name: /ask ai bajan/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/what would you like to know about barbados/i)).toBeInTheDocument();
    expect(
      screen.getByRole('search', { name: /search the barbados directory/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /find places and businesses across barbados/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /local favorites worth discovering/i }),
    ).toBeInTheDocument();
    // No duplicate "Ask AI Bajan" entry points on the homepage.
    expect(screen.queryByRole('button', { name: /open the ai bajan assistant/i })).not.toBeInTheDocument();
  });

  it('hero search navigates to the directory with query params', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const form = screen.getByRole('search', { name: /search the barbados directory/i });
    await user.selectOptions(within(form).getByLabelText(/category/i), 'restaurants');
    await user.selectOptions(within(form).getByLabelText(/area/i), 'Holetown');
    await user.click(within(form).getByRole('button', { name: /search/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /explore barbados businesses/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/2 businesses found/i)).toBeInTheDocument();
  });

  it('gives every button and link an accessible name', async () => {
    renderApp('/');
    await screen.findByRole('heading', { name: /local favorites worth discovering/i });
    for (const el of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
      expect(el).toHaveAccessibleName();
    }
  });
});

describe('navigation', () => {
  it.each([
    ['/discover', /one island, many moods/i],
    ['/guides', /stories and practical tips/i],
    ['/about', /discover barbados\. find local gems/i],
    ['/contact', /let’s talk barbados/i],
    ['/faq', /frequently asked questions/i],
    ['/privacy', /privacy policy/i],
    ['/terms', /terms of service/i],
    ['/places/holetown', /^holetown$/i],
    ['/category/restaurants', /restaurants & dining/i],
    ['/guides/exploring-the-west-coast', /exploring the west coast/i],
  ])('renders %s', async (route, heading) => {
    renderApp(route);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', async () => {
    renderApp('/no-such-page');
    expect(
      await screen.findByRole('heading', { level: 1, name: /page not found/i }),
    ).toBeInTheDocument();
  });

  it('header links navigate between pages', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'Businesses' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /explore barbados businesses/i }),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole('link', { name: /ai bajan home/i })[0]);
    expect(
      await screen.findByRole('heading', { level: 1, name: /ask barbados/i }),
    ).toBeInTheDocument();
  });
});

describe('directory', () => {
  it('search returns matching businesses', async () => {
    renderApp('/businesses?q=saltwind');
    expect(await screen.findByText(/1 business found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saltwind Beach Kitchen' })).toBeInTheDocument();
  });

  it('category filter limits results', async () => {
    const user = userEvent.setup();
    renderApp('/businesses');
    await screen.findByText(/37 businesses found/i);
    const filters = screen.getByRole('complementary', { name: 'Filters' });
    await user.click(within(filters).getByRole('radio', { name: /transportation/i }));
    expect(await screen.findByText(/3 businesses found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Island Hop Taxi Service' })).toBeInTheDocument();
  });

  it('location filter limits results', async () => {
    const user = userEvent.setup();
    renderApp('/businesses');
    await screen.findByText(/37 businesses found/i);
    const filters = screen.getByRole('complementary', { name: 'Filters' });
    await user.selectOptions(
      within(filters).getByRole('combobox', { name: /area or parish/i }),
      'Bathsheba',
    );
    expect(await screen.findByText(/4 businesses found/i)).toBeInTheDocument();
  });

  it('combined category + location from the URL shows only relevant listings', async () => {
    renderApp('/businesses?category=restaurants&location=Holetown');
    expect(await screen.findByText(/2 businesses found/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /leeward linen/i })).not.toBeInTheDocument();
  });

  it('clear all resets the filters', async () => {
    const user = userEvent.setup();
    renderApp('/businesses?category=restaurants&location=Holetown');
    await screen.findByText(/2 businesses found/i);
    const chips = screen.getByLabelText('Active filters');
    await user.click(within(chips).getByRole('button', { name: 'Clear all' }));
    expect(await screen.findByText(/37 businesses found/i)).toBeInTheDocument();
  });

  it('removing a filter chip updates results', async () => {
    const user = userEvent.setup();
    renderApp('/businesses?category=restaurants&location=Holetown');
    await screen.findByText(/2 businesses found/i);
    await user.click(screen.getByRole('button', { name: 'Remove filter: Holetown' }));
    expect(await screen.findByText(/8 businesses found/i)).toBeInTheDocument();
  });

  it('shows an empty state that keeps the search terms', async () => {
    renderApp('/businesses?q=zzzz-nothing');
    expect(
      await screen.findByRole('heading', { name: /no matching businesses/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/“zzzz-nothing”/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument();
  });

  it('paginates large result sets', async () => {
    const user = userEvent.setup();
    renderApp('/businesses');
    await screen.findByText(/37 businesses found/i);
    expect(screen.getByText(/showing 1–12/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(await screen.findByText(/showing 13–24/i)).toBeInTheDocument();
  });
});

describe('business detail', () => {
  it('displays the requested business', async () => {
    renderApp('/business/sample-holetown-restaurant');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Demo Holetown Restaurant' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /visit website/i })).toHaveAttribute(
      'href',
      'https://example.com/demo/holetown-restaurant',
    );
    expect(screen.getByRole('link', { name: /call business/i })).toHaveAttribute(
      'href',
      'tel:+12465550101',
    );
    expect(screen.getByText(/fictional demo listing/i)).toBeInTheDocument();
  });

  it('hides contact actions when no data exists', async () => {
    renderApp('/business/northern-trails-hiking');
    await screen.findByRole('heading', { level: 1, name: 'Northern Trails Hiking' });
    expect(screen.queryByRole('link', { name: /visit website/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /call business/i })).not.toBeInTheDocument();
    expect(screen.getByText(/hasn’t shared contact details/i)).toBeInTheDocument();
  });

  it('shows a not-found state for a missing slug', async () => {
    renderApp('/business/does-not-exist');
    expect(
      await screen.findByRole('heading', { level: 1, name: /business not found/i }),
    ).toBeInTheDocument();
  });

  it('opens the gallery lightbox and closes it with Escape', async () => {
    const user = userEvent.setup();
    renderApp('/business/turquoise-tide-catamaran');
    await screen.findByRole('heading', { level: 1, name: /turquoise tide/i });
    await user.click(screen.getByRole('button', { name: /open photo 1 of 5/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/photo 1 of 5/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /next photo/i }));
    expect(within(dialog).getByText(/photo 2 of 5/i)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

/** Ask a question through the homepage hero box (the single entry point). */
async function askFromHero(user, text) {
  const input = screen.getByLabelText(/what would you like to know about barbados/i);
  await waitFor(() => expect(input).toBeEnabled());
  await user.type(input, text);
  await user.click(screen.getByRole('button', { name: /^ask ai bajan/i }));
}

describe('AI chatbot', () => {
  it('opens and closes', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await askFromHero(user, 'Hello');
    const dialog = await screen.findByRole('dialog', { name: 'AI Bajan' });
    expect(within(dialog).getByText(/demo mode/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /close chat/i }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'AI Bajan' })).not.toBeInTheDocument(),
    );
  });

  it('does not send empty messages', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await askFromHero(user, 'Hello');
    const dialog = await screen.findByRole('dialog', { name: 'AI Bajan' });
    await waitFor(() => expect(within(dialog).getAllByText('Hello').length).toBe(1));
    const before = within(dialog).getAllByText(/./).length;
    await user.click(within(dialog).getByRole('button', { name: /send message/i }));
    expect(within(dialog).getByText(/type a question first/i)).toBeInTheDocument();
    // Nothing was sent: only the hint was added.
    expect(within(dialog).getAllByText('Hello')).toHaveLength(1);
    expect(within(dialog).getAllByText(/./).length).toBeLessThanOrEqual(before + 1);
  });

  it('answers with relevant directory results', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await askFromHero(user, 'Hello');
    const dialog = await screen.findByRole('dialog', { name: 'AI Bajan' });
    await user.type(
      within(dialog).getByLabelText(/ask ai bajan a question/i),
      'Find restaurants near Holetown{Enter}',
    );
    const results = await within(dialog).findByRole('list', { name: /directory results/i });
    const links = within(results).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(
      expect.arrayContaining([expect.stringMatching(/Saltwind Beach Kitchen/)]),
    );
    expect(within(results).queryByText(/leeward linen/i)).not.toBeInTheDocument();
  });

  it('shows a retry action when a request fails', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await askFromHero(user, 'Hello');
    const dialog = await screen.findByRole('dialog', { name: 'AI Bajan' });
    await user.type(
      within(dialog).getByLabelText(/ask ai bajan a question/i),
      'simulate failure{Enter}',
    );
    expect(await within(dialog).findByText(/message not answered/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

describe('forms', () => {
  it('contact form validates required fields', async () => {
    const user = userEvent.setup();
    renderApp('/contact');
    await user.click(await screen.findByRole('button', { name: /send message/i }));
    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument();
    expect(screen.getByText(/please enter your email address/i)).toBeInTheDocument();
    expect(screen.getByText(/please add a short subject/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 20 characters/i)).toBeInTheDocument();
  });

  it('contact form submits in demo mode without claiming it was sent', async () => {
    const user = userEvent.setup();
    renderApp('/contact?topic=listing');
    await user.type(await screen.findByLabelText('Name'), 'Test Visitor');
    await user.type(screen.getByLabelText('Email'), 'visitor@example.com');
    expect(screen.getByLabelText('Inquiry type')).toHaveValue('listing');
    await user.type(screen.getByLabelText('Subject'), 'Listing request');
    await user.type(
      screen.getByLabelText('Message'),
      'I would like to know more about listing my guesthouse.',
    );
    await user.click(screen.getByRole('button', { name: /send message/i }));
    expect(await screen.findByText(/was not sent/i)).toBeInTheDocument();
  });

  it('newsletter validates email and consent', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewsletterForm />);
    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /subscribe/i }));
    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/please confirm/i)).toBeInTheDocument();
  });

  it('newsletter is honest in demo mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewsletterForm />);
    await user.type(screen.getByLabelText('Email address'), 'visitor@example.com');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /subscribe/i }));
    expect(await screen.findByText(/you have not been subscribed/i)).toBeInTheDocument();
  });
});

describe('mobile navigation', () => {
  it('opens the drawer, navigates, and closes with Escape', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const drawer = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(drawer).getByRole('navigation', { name: 'Mobile' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const again = await screen.findByRole('dialog', { name: 'Menu' });
    await user.click(within(again).getByRole('link', { name: /^businesses$/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /explore barbados businesses/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument(),
    );
  });
});

describe('FAQ', () => {
  it('toggles accordion items with proper expanded state', async () => {
    const user = userEvent.setup();
    renderApp('/faq');
    const trigger = await screen.findByRole('button', {
      name: /what does a sponsored listing mean/i,
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/always labelled “sponsored”/i)).toBeInTheDocument();
  });
});

describe('rating display', () => {
  it('renders nothing without genuine sourced data', () => {
    const { container } = render(<RatingDisplay rating={4.8} />);
    expect(container).toBeEmptyDOMElement();
  });
});
