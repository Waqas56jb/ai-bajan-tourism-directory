import { describe, expect, it } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './utils';

const h1 = (name, timeout) => screen.findByRole('heading', { level: 1, name }, timeout ? { timeout } : undefined);

describe('authentication', () => {
  it('redirects signed-out visitors to the login page', async () => {
    renderApp('/listings', { signedIn: false });
    expect(await h1(/sign in/i)).toBeInTheDocument();
  });

  it('validates the login form and signs in with the demo account', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/login', { signedIn: false });
    await h1(/sign in/i);
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/email/i), 'admin.demo@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'demo-password');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    // First visit lazily loads the dashboard and chart code, which is slow on a cold test run.
    expect(await h1('Dashboard', 35000)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows an error for a non-demo account', async () => {
    const user = userEvent.setup();
    renderApp('/login', { signedIn: false });
    await h1(/sign in/i);
    await user.type(screen.getByLabelText(/email/i), 'someone@else.com');
    await user.type(screen.getByLabelText(/^password/i), 'demo-password');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no demo account/i);
  });
});

describe('navigation', () => {
  it('renders the dashboard with KPIs and quick actions', async () => {
    renderApp('/');
    expect(await h1('Dashboard')).toBeInTheDocument();
    expect(await screen.findByText('Total listings')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review submissions/i })).toHaveAttribute(
      'href',
      '/listings/submissions',
    );
  });

  it('sidebar links navigate and mark the active page', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await h1('Dashboard');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    await user.click(within(nav).getByRole('link', { name: 'Categories' }));
    expect(await h1('Categories')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Categories' })).toHaveAttribute('aria-current', 'page');
  });

  it('builds breadcrumbs with record names', async () => {
    renderApp('/listings/lst-003/edit');
    const crumbs = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() =>
      expect(within(crumbs).getByRole('link', { name: 'Turquoise Tide Catamaran Cruises' })).toHaveAttribute(
        'href',
        '/listings/lst-003',
      ),
    );
    expect(within(crumbs).getByText('Edit')).toHaveAttribute('aria-current', 'page');
  });

  it('shows a 404 page for unknown routes', async () => {
    renderApp('/does-not-exist');
    expect(await h1('Page not found')).toBeInTheDocument();
  });

  it.each([
    ['/listings/submissions', 'Pending submissions'],
    ['/locations', 'Locations'],
    ['/knowledge', 'Knowledge base'],
    ['/knowledge/faqs', 'FAQs'],
    ['/knowledge/sync', 'Knowledge sync'],
    ['/chatbot', 'AI assistant overview'],
    ['/chatbot/conversations', 'Conversations'],
    ['/chatbot/settings', 'Chatbot settings'],
    ['/chatbot/questions', 'Questions report'],
    ['/listings/classifieds', 'Jobs & classifieds'],
    ['/listings/applications', 'Business & contributor applications'],
    ['/advertising', 'Advertisements'],
    ['/advertising/featured', 'Featured listings'],
    ['/users', 'Users'],
    ['/administrators', 'Administrators'],
    ['/feedback', 'Feedback & reports'],
    ['/activity', 'Activity logs'],
    ['/monitoring/health', 'System health'],
    ['/monitoring/errors', 'Error logs'],
    ['/settings/general', 'Settings'],
  ])('renders %s', async (route, title) => {
    renderApp(route);
    expect(await h1(title)).toBeInTheDocument();
  });
});

describe('listings', () => {
  it('searches and filters the table', async () => {
    const user = userEvent.setup();
    renderApp('/listings');
    expect(await screen.findByText(/24 directory listings/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search listings'), 'saltwind');
    expect(await screen.findByRole('link', { name: 'Saltwind Beach Kitchen' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2)); // header + 1 result
    await user.clear(screen.getByLabelText('Search listings'));
    await user.selectOptions(screen.getByLabelText('Status'), 'pending');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(5)); // header + 4 pending
  });

  it('deletes a listing only after confirmation', async () => {
    const user = userEvent.setup();
    renderApp('/listings?q=saltwind');
    await screen.findByRole('link', { name: 'Saltwind Beach Kitchen' });
    await user.click(screen.getByRole('button', { name: 'Actions for Saltwind Beach Kitchen' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: /delete listing permanently/i });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Saltwind Beach Kitchen' })).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('Listing deleted')).toBeInTheDocument();
  });

  it('validates and creates a listing with a generated slug', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/listings/new');
    await h1('Add listing');
    await user.click(await screen.findByRole('button', { name: /save and publish/i }));
    expect(await screen.findByText('Business name is required.')).toBeInTheDocument();
    expect(screen.getByText('Choose a primary category.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/business name/i), 'Coconut Grove Café');
    expect(screen.getByLabelText(/url slug/i)).toHaveValue('coconut-grove-cafe');
    await user.type(screen.getByLabelText(/short description/i), 'Breakfast under the palms.');
    await user.type(
      screen.getByLabelText(/full description/i),
      'A relaxed café serving breakfast and lunch under the palms in Holetown.',
    );
    await user.selectOptions(screen.getByLabelText(/primary category/i), 'cat-restaurants');
    await user.selectOptions(screen.getByLabelText(/island or region/i), 'loc-st-james');
    await user.selectOptions(screen.getByLabelText(/city or town/i), 'loc-holetown');
    await user.click(screen.getByRole('button', { name: /save and publish/i }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/listings\/lst-/));
    expect(await h1('Coconut Grove Café')).toBeInTheDocument();
  });

  it('requires a reason to reject a submission', async () => {
    const user = userEvent.setup();
    renderApp('/listings/submissions');
    await screen.findByText('Sunset Rum Shack');
    const rows = screen.getAllByRole('row');
    const row = rows.find((r) => within(r).queryByText('Sunset Rum Shack'));
    await user.click(within(row).getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reject listing' }));
    expect(await within(dialog).findByText('Reason for rejection is required.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/reason for rejection/i), 'Missing proof of registration.');
    await user.click(within(dialog).getByRole('button', { name: 'Reject listing' }));
    await waitFor(() => expect(screen.queryByText('Sunset Rum Shack')).not.toBeInTheDocument());
  });
});

describe('knowledge & chatbot', () => {
  it('validates FAQ publishing and shows a chatbot preview', async () => {
    const user = userEvent.setup();
    renderApp('/knowledge/faqs');
    await h1('FAQs');
    await user.click(screen.getByRole('button', { name: 'Add FAQ' }));
    const drawer = await screen.findByRole('dialog', { name: 'New FAQ' });
    await user.type(within(drawer).getByLabelText(/question/i), 'Is there parking in Bridgetown?');
    expect(within(drawer).getByRole('img', { name: /chat widget preview/i })).toHaveTextContent(
      'Is there parking in Bridgetown?',
    );
    await user.click(within(drawer).getByRole('button', { name: 'Save and publish' }));
    expect(await within(drawer).findByText('Published FAQs need an answer.')).toBeInTheDocument();
  });

  it('adds an internal note and flags a conversation', async () => {
    const user = userEvent.setup();
    renderApp('/chatbot/conversations/conv-2318');
    await h1('Conversation conv-2318');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Write a note before adding it.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/add internal note/i), 'Good grounded answer.');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Good grounded answer.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Flag' }));
    expect(await screen.findByText('Flagged for investigation')).toBeInTheDocument();
  });

  it('tracks unsaved chatbot settings and saves them', async () => {
    const user = userEvent.setup();
    renderApp('/chatbot/settings');
    const name = await screen.findByLabelText(/display name/i);
    await user.clear(name);
    await user.type(name, 'Bajan Guide');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/chatbot settings saved/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument());
  });
});

describe('global search', () => {
  it('shows grouped results and an empty state', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await h1('Dashboard');
    const box = screen.getByRole('combobox', { name: /search the admin/i });
    await user.type(box, 'coral');
    const list = await screen.findByRole('listbox', { name: 'Search results' });
    expect(await within(list).findByText('Coral Cove Guesthouse')).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'qqqqzz');
    expect(await screen.findByText(/no results for/i)).toBeInTheDocument();
  });
});
