export default function TermsPage() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div
        className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block"
        id="terms-scroll-container"
      >
        <div className="mx-auto max-w-4xl py-12">
          <div className="rounded-lg bg-white/80 p-8 shadow-sm backdrop-blur-sm dark:bg-neutral-900/80">
            <h1 className="mb-8 text-4xl font-bold text-neutral-900 dark:text-white">
              Terms and Conditions
            </h1>

            <div className="prose prose-neutral max-w-none space-y-6 dark:prose-invert">
              <section>
                <h2 className="mb-4 text-2xl font-semibold">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using Veritable Games services, you accept and agree to be bound
                  by the terms and provision of this agreement. If you do not agree to these terms,
                  you should not use our services.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">2. Use License</h2>
                <p>
                  Permission is granted to temporarily access the materials on Veritable Games for
                  personal, non-commercial transitory viewing only. This is the grant of a license,
                  not a transfer of title, and under this license you may not:
                </p>
                <ul className="ml-6 mt-2 list-disc space-y-1">
                  <li>modify or copy the materials</li>
                  <li>use the materials for any commercial purpose or for any public display</li>
                  <li>attempt to reverse engineer any software contained on our services</li>
                  <li>remove any copyright or other proprietary notations from the materials</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">3. User Content</h2>
                <p>
                  Users may submit content including but not limited to forum posts, comments, and
                  project submissions. By submitting content, you grant Veritable Games a
                  non-exclusive, royalty-free license to use, display, and distribute such content
                  in connection with our services.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">4. Privacy Policy</h2>
                <p>
                  Your privacy is important to us. We collect and use information in accordance with
                  our Privacy Policy, which is incorporated into these Terms by reference. We
                  implement appropriate security measures to protect your personal information.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">5. Disclaimer</h2>
                <p>
                  The materials on Veritable Games are provided on an 'as is' basis. Veritable Games
                  makes no warranties, expressed or implied, and hereby disclaims and negates all
                  other warranties including without limitation, implied warranties or conditions of
                  merchantability, fitness for a particular purpose, or non-infringement of
                  intellectual property or other violation of rights.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">6. Limitations</h2>
                <p>
                  In no event shall Veritable Games or its suppliers be liable for any damages
                  (including, without limitation, damages for loss of data or profit, or due to
                  business interruption) arising out of the use or inability to use the materials on
                  our services, even if Veritable Games or an authorized representative has been
                  notified orally or in writing of the possibility of such damage.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">7. Governing Law</h2>
                <p>
                  These terms and conditions are governed by and construed in accordance with
                  applicable laws and you irrevocably submit to the exclusive jurisdiction of the
                  courts in that state or location.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">8. Changes to Terms</h2>
                <p>
                  Veritable Games reserves the right to modify these terms at any time. We will
                  notify users of any significant changes via our website or email. Your continued
                  use of our services after such modifications constitutes acceptance of the updated
                  terms.
                </p>
              </section>
            </div>

            <div className="mt-12 border-t border-neutral-200 pt-6 dark:border-neutral-700">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Last updated:{' '}
                {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
