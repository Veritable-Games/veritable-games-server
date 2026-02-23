export default function PrivacyPage() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div
        className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block"
        id="privacy-scroll-container"
      >
        <div className="mx-auto max-w-4xl py-12">
          <div className="rounded-lg bg-white/80 p-8 shadow-sm backdrop-blur-sm dark:bg-neutral-900/80">
            <h1 className="mb-8 text-4xl font-bold text-neutral-900 dark:text-white">
              Privacy Policy
            </h1>

            <div className="prose prose-neutral max-w-none space-y-6 dark:prose-invert">
              <section>
                <h2 className="mb-4 text-2xl font-semibold">1. Information We Collect</h2>
                <p>
                  We collect information you provide directly to us when you create an account,
                  participate in forums, submit content, or contact us. This may include:
                </p>
                <ul className="ml-6 mt-2 list-disc space-y-1">
                  <li>Username, email address, and password</li>
                  <li>Forum posts, comments, and project submissions</li>
                  <li>Profile information you choose to provide</li>
                  <li>Communications between you and Veritable Games</li>
                </ul>
                <p className="mt-4">
                  We automatically collect certain information when you use our services, including:
                </p>
                <ul className="ml-6 mt-2 list-disc space-y-1">
                  <li>Log data (IP address, browser type, pages visited)</li>
                  <li>Device information (hardware model, operating system)</li>
                  <li>Usage information (features used, time spent, interactions)</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">2. How We Use Your Information</h2>
                <p>We use the information we collect to:</p>
                <ul className="ml-6 mt-2 list-disc space-y-1">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Create and manage your account</li>
                  <li>Enable community features like forums and project sharing</li>
                  <li>Send you technical notices and support messages</li>
                  <li>Respond to your comments and questions</li>
                  <li>Monitor and analyze usage patterns and trends</li>
                  <li>Detect and prevent fraudulent or illegal activities</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">3. Information Sharing</h2>
                <p>
                  We do not sell, trade, or rent your personal information to third parties. We may
                  share your information in the following circumstances:
                </p>
                <ul className="ml-6 mt-2 list-disc space-y-1">
                  <li>With your consent or at your direction</li>
                  <li>With service providers who assist in our operations</li>
                  <li>To comply with legal obligations or respond to legal requests</li>
                  <li>
                    To protect the rights, property, or safety of Veritable Games and our users
                  </li>
                  <li>
                    In connection with a merger, sale, or acquisition of all or part of our company
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">4. Data Security</h2>
                <p>
                  We implement appropriate technical and organizational measures to protect your
                  personal information against unauthorized access, alteration, disclosure, or
                  destruction. These measures include:
                </p>
                <ul className="ml-6 mt-2 list-disc space-y-1">
                  <li>Encryption of sensitive data in transit and at rest</li>
                  <li>Regular security assessments and updates</li>
                  <li>Limited access to personal information by employees</li>
                  <li>Secure password requirements and hashing</li>
                </ul>
                <p className="mt-4">
                  However, no method of transmission over the Internet or electronic storage is 100%
                  secure, and we cannot guarantee absolute security of your information.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">5. Your Rights and Choices</h2>
                <p>You have certain rights regarding your personal information:</p>
                <ul className="ml-6 mt-2 list-disc space-y-1">
                  <li>
                    <strong>Access:</strong> Request a copy of your personal information
                  </li>
                  <li>
                    <strong>Correction:</strong> Request correction of inaccurate information
                  </li>
                  <li>
                    <strong>Deletion:</strong> Request deletion of your account and associated data
                  </li>
                  <li>
                    <strong>Portability:</strong> Request your data in a machine-readable format
                  </li>
                  <li>
                    <strong>Opt-out:</strong> Unsubscribe from marketing communications
                  </li>
                </ul>
                <p className="mt-4">
                  To exercise these rights, please contact us using the information provided below.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">6. Cookies and Tracking</h2>
                <p>
                  We use cookies and similar tracking technologies to collect information about your
                  browsing activities. For detailed information about our cookie usage, please see
                  our
                  <a
                    href="/cookies"
                    className="ml-1 text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Cookie Policy
                  </a>
                  .
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">7. Children's Privacy</h2>
                <p>
                  Our services are not directed to individuals under the age of 13. We do not
                  knowingly collect personal information from children under 13. If we become aware
                  that we have collected personal information from a child under 13, we will take
                  steps to delete such information.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">8. International Data Transfers</h2>
                <p>
                  Your information may be transferred to and maintained on servers located outside
                  of your state, province, country, or other governmental jurisdiction where data
                  protection laws may differ. By using our services, you consent to such transfers.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">9. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any
                  changes by posting the new Privacy Policy on this page and updating the "Last
                  updated" date. Your continued use of our services after such modifications
                  constitutes your acknowledgment and acceptance of the updated Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">10. Contact Us</h2>
                <p>
                  If you have any questions about this Privacy Policy or our privacy practices,
                  please contact us at:
                </p>
                <div className="mt-4 rounded bg-neutral-100 p-4 dark:bg-neutral-800">
                  <p className="font-medium">Veritable Games</p>
                  <p>Email: privacy@veritablegames.com</p>
                  <p>
                    Forum:{' '}
                    <a href="/forums" className="text-blue-600 hover:underline dark:text-blue-400">
                      Community Support
                    </a>
                  </p>
                </div>
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
