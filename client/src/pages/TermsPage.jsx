import { termsOfService } from '@/data/legal';
import { LegalPage } from './LegalPage';

export default function TermsPage() {
  return (
    <LegalPage
      doc={termsOfService}
      path="/terms"
      description="Draft terms of service for the AI Bajan website and travel assistant."
    />
  );
}
