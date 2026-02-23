import { ContactForm } from '@/components/contact/ContactForm';
import { EditableDescription } from '@/components/ui/EditableDescription';

export default function ContactPage() {
  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden px-8 py-6">
      <div className="mb-4 flex-shrink-0">
        <h1 className="mb-2 text-3xl font-bold text-white">Contact Us</h1>
        <EditableDescription
          pageKey="contact"
          initialText="Have a question, suggestion, or feedback? We'd love to hear from you. Fill out the form below and we'll get back to you as soon as possible."
          className="text-lg text-gray-400"
        />
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        <section className="rounded border border-gray-700 bg-gray-900/70 p-6">
          <ContactForm />
        </section>

        <section className="rounded border border-gray-700 bg-gray-900/70 p-6">
          <h3 className="mb-3 font-medium text-white">What to expect:</h3>
          <ul className="space-y-2 text-gray-300">
            <li>• We typically respond within 24-48 hours</li>
            <li>• For urgent issues, please include "URGENT" in your subject line</li>
            <li>• All messages are reviewed by our team</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Contact Us',
  description: 'Get in touch with our team for questions, feedback, or support.',
};
