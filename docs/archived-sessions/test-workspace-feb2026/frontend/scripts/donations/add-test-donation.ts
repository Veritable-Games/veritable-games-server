/**
 * Add Test Donation (Admin Only)
 * Creates a test donation to see the management view on /donate
 */

import { dbAdapter } from '../../src/lib/database/adapter';

async function addTestDonation() {
  try {
    console.log('🔍 Finding admin user...');

    // Get admin user
    const userResult = await dbAdapter.query(
      'SELECT id, username, email FROM users WHERE role = ? LIMIT 1',
      ['admin'],
      { schema: 'users' }
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      console.error('❌ No admin user found');
      process.exit(1);
    }

    const adminUser = userResult.rows[0];
    console.log(`✅ Found admin: ${adminUser.username} (ID: ${adminUser.id})`);

    // Get a funding project
    const projectResult = await dbAdapter.query(
      'SELECT id, name, slug FROM funding_projects WHERE is_active = ? LIMIT 1',
      [true],
      { schema: 'donations' }
    );

    if (!projectResult.rows || projectResult.rows.length === 0) {
      console.error('❌ No active funding projects found');
      process.exit(1);
    }

    const project = projectResult.rows[0];
    console.log(`✅ Found project: ${project.name} (ID: ${project.id})`);

    // Insert test donation
    console.log('💰 Creating test donation...');
    const donationResult = await dbAdapter.query(
      `INSERT INTO donations (
        user_id,
        amount,
        currency,
        payment_processor,
        payment_id,
        payment_status,
        donor_name,
        donor_email,
        is_anonymous,
        message,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id`,
      [
        adminUser.id,
        25.0, // $25 test donation
        'USD',
        'other', // Test payment
        `test-${Date.now()}`,
        'completed',
        adminUser.username,
        adminUser.email,
        false,
        'Test donation to preview management view',
        new Date().toISOString(),
      ],
      { schema: 'donations' }
    );

    const donationId = donationResult.rows[0].id;
    console.log(`✅ Created donation ID: ${donationId}`);

    // Create allocation (100% to the project)
    await dbAdapter.query(
      `INSERT INTO donation_allocations (
        donation_id,
        project_id,
        amount,
        percentage
      ) VALUES (?, ?, ?, ?)`,
      [donationId, project.id, 25.0, 100.0],
      { schema: 'donations' }
    );

    console.log(`✅ Created allocation: $25.00 → ${project.name}`);

    console.log('\n✨ Success! Test donation created:');
    console.log(`   User: ${adminUser.username}`);
    console.log(`   Amount: $25.00 USD`);
    console.log(`   Project: ${project.name}`);
    console.log(`   Status: completed`);
    console.log('\n🎯 You can now visit /donate to see the management view!');
  } catch (error) {
    console.error('❌ Error creating test donation:', error);
    process.exit(1);
  }
}

addTestDonation();
