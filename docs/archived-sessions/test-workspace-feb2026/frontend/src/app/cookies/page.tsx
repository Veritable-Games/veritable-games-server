export default function CookiesPage() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div
        className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block"
        id="cookies-scroll-container"
      >
        <div className="mx-auto max-w-4xl py-12">
          <div className="rounded-lg bg-white/80 p-8 shadow-sm backdrop-blur-sm dark:bg-neutral-900/80">
            <h1 className="mb-8 text-4xl font-bold text-neutral-900 dark:text-white">
              Cookie Policy
            </h1>

            <div className="prose prose-neutral max-w-none space-y-6 dark:prose-invert">
              <section>
                <h2 className="mb-4 text-2xl font-semibold">1. What Are Cookies</h2>
                <p>
                  Cookies are small text files that are placed on your device when you visit our
                  website. They help us provide you with a better experience by remembering your
                  preferences, analyzing how you use our services, and enabling certain features.
                </p>
                <p className="mt-4">
                  This Cookie Policy explains what cookies are, how we use them, and your choices
                  regarding their use on Veritable Games services.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">2. How We Use Cookies</h2>
                <p>We use cookies for the following purposes:</p>
                <ul className="ml-6 mt-2 list-disc space-y-1">
                  <li>
                    <strong>Authentication:</strong> To identify you when you sign in and keep you
                    logged in
                  </li>
                  <li>
                    <strong>Preferences:</strong> To remember your settings and preferences
                  </li>
                  <li>
                    <strong>Security:</strong> To support security features and detect malicious
                    activity
                  </li>
                  <li>
                    <strong>Analytics:</strong> To understand how you use our services and improve
                    them
                  </li>
                  <li>
                    <strong>Performance:</strong> To optimize the performance of our website
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">3. Types of Cookies We Use</h2>

                <div className="mt-6">
                  <h3 className="mb-3 text-xl font-medium">Essential Cookies</h3>
                  <p>
                    These cookies are necessary for the website to function properly. They enable
                    core functionality such as security, network management, and accessibility. You
                    cannot opt-out of these cookies as they are essential for the service to work.
                  </p>
                  <ul className="ml-6 mt-2 list-disc space-y-1">
                    <li>Session management cookies</li>
                    <li>Authentication cookies</li>
                    <li>Security cookies</li>
                  </ul>
                </div>

                <div className="mt-6">
                  <h3 className="mb-3 text-xl font-medium">Functional Cookies</h3>
                  <p>
                    These cookies enable enhanced functionality and personalization, such as
                    remembering your preferences and settings. If you do not allow these cookies,
                    some or all of these services may not function properly.
                  </p>
                  <ul className="ml-6 mt-2 list-disc space-y-1">
                    <li>Language preferences</li>
                    <li>Theme settings (dark/light mode)</li>
                    <li>User interface preferences</li>
                  </ul>
                </div>

                <div className="mt-6">
                  <h3 className="mb-3 text-xl font-medium">Analytics Cookies</h3>
                  <p>
                    These cookies help us understand how visitors interact with our website by
                    collecting and reporting information anonymously. This helps us improve our
                    services and user experience.
                  </p>
                  <ul className="ml-6 mt-2 list-disc space-y-1">
                    <li>Page view statistics</li>
                    <li>User behavior patterns</li>
                    <li>Performance metrics</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">4. Cookie Duration</h2>
                <p>We use both session and persistent cookies:</p>
                <ul className="ml-6 mt-2 list-disc space-y-1">
                  <li>
                    <strong>Session Cookies:</strong> These are temporary cookies that remain on
                    your device until you close your browser. They are deleted automatically when
                    you end your browsing session.
                  </li>
                  <li>
                    <strong>Persistent Cookies:</strong> These cookies remain on your device for a
                    set period or until you manually delete them. They help us remember your
                    preferences for your next visit.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">5. Third-Party Cookies</h2>
                <p>
                  We may use third-party services that set their own cookies. These services
                  include:
                </p>
                <ul className="ml-6 mt-2 list-disc space-y-1">
                  <li>Analytics providers (to help us understand usage patterns)</li>
                  <li>Content delivery networks (to efficiently deliver resources)</li>
                  <li>Security services (to protect against malicious activity)</li>
                </ul>
                <p className="mt-4">
                  These third parties have their own privacy policies addressing how they use such
                  information. We have no access to or control over these third-party cookies.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">6. Managing Cookies</h2>
                <p>You have several options for managing cookies:</p>

                <div className="mt-4">
                  <h3 className="mb-2 text-lg font-medium">Browser Settings</h3>
                  <p>
                    Most web browsers allow you to control cookies through their settings. You can:
                  </p>
                  <ul className="ml-6 mt-2 list-disc space-y-1">
                    <li>View what cookies are stored on your device</li>
                    <li>Delete some or all cookies</li>
                    <li>Block cookies from specific websites or all websites</li>
                    <li>Set your browser to notify you when cookies are being set</li>
                  </ul>
                </div>

                <div className="mt-4">
                  <h3 className="mb-2 text-lg font-medium">Impact of Disabling Cookies</h3>
                  <p>
                    Please note that if you disable cookies, some features of our website may not
                    function properly. You may not be able to:
                  </p>
                  <ul className="ml-6 mt-2 list-disc space-y-1">
                    <li>Stay logged in to your account</li>
                    <li>Save your preferences</li>
                    <li>Access certain secure areas</li>
                    <li>Use all features of our services</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">7. Do Not Track</h2>
                <p>
                  Some browsers include a "Do Not Track" (DNT) feature that signals to websites that
                  you do not want to have your online activity tracked. Currently, our website does
                  not respond to DNT signals, but we limit tracking to the purposes described in
                  this policy.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">8. Updates to This Policy</h2>
                <p>
                  We may update this Cookie Policy from time to time to reflect changes in our
                  practices or for other operational, legal, or regulatory reasons. We will post the
                  updated policy on this page with a revised "Last updated" date.
                </p>
              </section>

              <section>
                <h2 className="mb-4 text-2xl font-semibold">9. Contact Us</h2>
                <p>
                  If you have questions about our use of cookies or this Cookie Policy, please
                  contact us:
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

              <section>
                <h2 className="mb-4 text-2xl font-semibold">10. More Information</h2>
                <p>For more information about cookies and how to manage them, you can visit:</p>
                <ul className="ml-6 mt-2 list-disc space-y-1">
                  <li>
                    <a
                      href="https://www.allaboutcookies.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      AllAboutCookies.org
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.youronlinechoices.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Your Online Choices
                    </a>
                  </li>
                </ul>
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
