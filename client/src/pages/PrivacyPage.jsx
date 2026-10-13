import { privacyPolicy } from '@/data/legal';
import { LegalPage } from './LegalPage';

export default function PrivacyPage() {
  return (
    <LegalPage
      doc={privacyPolicy}
      path="/privacy"
      description="Draft privacy policy for the AI Bajan website and travel assistant."
    />
  );
}
