'use client';

import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { EditableText } from '@/components/about/EditableText';
import { TeamMemberCard } from '@/components/about/TeamMemberCard';
import { AddTeamMemberDialog } from '@/components/about/AddTeamMemberDialog';
import { CommissionCreditCard } from '@/components/about/CommissionCreditCard';
import { AddCommissionCreditButton } from '@/components/about/AddCommissionCreditButton';
import { fetchJSON } from '@/lib/utils/csrf';

interface TeamMember {
  id: number;
  user_id: number;
  title: string | null;
  tags: string[];
  display_order: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface CommissionCredit {
  id: number;
  project_name: string;
  client_name: string;
  description: string | null;
  project_type: string | null;
  color: string | null;
}

interface AboutPageClientProps {
  initialTeamMembers: TeamMember[];
  initialCommissionCredits: CommissionCredit[];
  pageTitle: string;
  missionText: string;
  commissionIntro: string;
  isAdmin: boolean;
}

export default function AboutPageClient({
  initialTeamMembers,
  initialCommissionCredits,
  pageTitle,
  missionText,
  commissionIntro,
  isAdmin,
}: AboutPageClientProps) {
  const [title, setTitle] = useState(pageTitle);
  const [mission, setMission] = useState(missionText);
  const [intro, setIntro] = useState(commissionIntro);
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [credits, setCredits] = useState(initialCommissionCredits);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);

  // Section headings (editable)
  const [missionHeading, setMissionHeading] = useState('Our Mission');
  const [teamHeading, setTeamHeading] = useState('Our Team');
  const [creditsHeading, setCreditsHeading] = useState('Commission Credits');

  // Simple text editing states
  const [editingMission, setEditingMission] = useState(false);
  const [editingIntro, setEditingIntro] = useState(false);
  const [tempMission, setTempMission] = useState(mission);
  const [tempIntro, setTempIntro] = useState(intro);

  const handleTitleSave = async (newTitle: string) => {
    await fetchJSON('/api/about/text', {
      method: 'POST',
      body: { key: 'title', value: newTitle },
    });
  };

  const handleMissionHeadingSave = async (newHeading: string) => {
    await fetchJSON('/api/about/text', {
      method: 'POST',
      body: { key: 'mission_heading', value: newHeading },
    });
  };

  const handleTeamHeadingSave = async (newHeading: string) => {
    await fetchJSON('/api/about/text', {
      method: 'POST',
      body: { key: 'team_heading', value: newHeading },
    });
  };

  const handleCreditsHeadingSave = async (newHeading: string) => {
    await fetchJSON('/api/about/text', {
      method: 'POST',
      body: { key: 'credits_heading', value: newHeading },
    });
  };

  const handleMissionSave = async () => {
    await fetchJSON('/api/about/text', {
      method: 'POST',
      body: { key: 'mission', value: tempMission },
    });
    setMission(tempMission);
    setEditingMission(false);
  };

  const handleIntroSave = async () => {
    await fetchJSON('/api/about/text', {
      method: 'POST',
      body: { key: 'commission_intro', value: tempIntro },
    });
    setIntro(tempIntro);
    setEditingIntro(false);
  };

  const refreshTeamMembers = async () => {
    const response = await fetchJSON<{ members: TeamMember[] }>('/api/about/team-members');
    setTeamMembers(response.members);
  };

  const refreshCredits = async () => {
    const response = await fetchJSON<{ credits: CommissionCredit[] }>(
      '/api/about/commission-credits'
    );
    setCredits(response.credits);
  };

  const handleMissionClick = (e: React.MouseEvent) => {
    if (isAdmin && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setTempMission(mission);
      setEditingMission(true);
    }
  };

  const handleIntroClick = (e: React.MouseEvent) => {
    if (isAdmin && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setTempIntro(intro);
      setEditingIntro(true);
    }
  };

  // Split mission text into paragraphs
  const missionParagraphs = mission.split('\n\n').filter(p => p.trim());

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden px-8 py-6">
      <div className="mb-4 flex-shrink-0">
        <EditableText
          value={title}
          onChange={setTitle}
          onSave={handleTitleSave}
          canEdit={isAdmin}
          className="text-3xl font-bold text-white"
          as="h1"
        />
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        {/* Mission Statement */}
        <section className="rounded border border-gray-700 bg-gray-900/70 p-6">
          <EditableText
            value={missionHeading}
            onChange={setMissionHeading}
            onSave={handleMissionHeadingSave}
            canEdit={isAdmin}
            className="mb-4 text-2xl font-bold text-white"
            as="h2"
          />
          {editingMission ? (
            <div className="space-y-3">
              <textarea
                value={tempMission}
                onChange={e => setTempMission(e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 p-3 text-gray-300 focus:border-blue-500 focus:outline-none"
                rows={10}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setEditingMission(false);
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleMissionSave}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingMission(false)}
                  className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={handleMissionClick}
              className={`space-y-4 leading-relaxed text-gray-300 ${isAdmin ? 'cursor-text' : ''}`}
              title={isAdmin ? 'Ctrl+click to edit' : undefined}
            >
              {missionParagraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          )}
        </section>

        {/* Team Section */}
        <section>
          <EditableText
            value={teamHeading}
            onChange={setTeamHeading}
            onSave={handleTeamHeadingSave}
            canEdit={isAdmin}
            className="mb-6 text-2xl font-bold text-white"
            as="h2"
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {teamMembers.map(member => (
              <TeamMemberCard
                key={member.id}
                member={member}
                canEdit={isAdmin}
                onUpdate={refreshTeamMembers}
              />
            ))}
            {isAdmin && (
              <button
                onClick={() => setShowAddMemberDialog(true)}
                className="flex flex-col items-center justify-center rounded border border-dashed border-gray-600 bg-gray-900/50 p-6 text-gray-400 transition-colors hover:border-blue-600 hover:text-blue-400"
              >
                <PlusIcon className="mb-2 h-8 w-8" />
                <span className="font-medium">Add Team Member</span>
              </button>
            )}
          </div>
        </section>

        {/* Commission Credits Section */}
        <section>
          <EditableText
            value={creditsHeading}
            onChange={setCreditsHeading}
            onSave={handleCreditsHeadingSave}
            canEdit={isAdmin}
            className="mb-4 text-2xl font-bold text-white"
            as="h2"
          />

          {/* Intro text outside the card */}
          {editingIntro ? (
            <div className="mb-6 space-y-3">
              <textarea
                value={tempIntro}
                onChange={e => setTempIntro(e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 p-3 text-gray-300 focus:border-blue-500 focus:outline-none"
                rows={3}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setEditingIntro(false);
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleIntroSave}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingIntro(false)}
                  className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p
              onClick={handleIntroClick}
              className={`mb-6 text-gray-300 ${isAdmin ? 'cursor-text' : ''}`}
              title={isAdmin ? 'Ctrl+click to edit' : undefined}
            >
              {intro}
            </p>
          )}

          <div className="rounded border border-gray-700 bg-gray-900/70 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                {credits.slice(0, Math.ceil(credits.length / 2)).map(credit => (
                  <CommissionCreditCard
                    key={credit.id}
                    credit={credit}
                    canEdit={isAdmin}
                    onUpdate={refreshCredits}
                    onDelete={refreshCredits}
                  />
                ))}
              </div>
              <div className="space-y-3">
                {credits.slice(Math.ceil(credits.length / 2)).map(credit => (
                  <CommissionCreditCard
                    key={credit.id}
                    credit={credit}
                    canEdit={isAdmin}
                    onUpdate={refreshCredits}
                    onDelete={refreshCredits}
                  />
                ))}
                {/* Add button always at the end of the second column */}
                {isAdmin && <AddCommissionCreditButton onAdded={refreshCredits} inline />}
              </div>
            </div>
          </div>
        </section>
      </div>

      <AddTeamMemberDialog
        isOpen={showAddMemberDialog}
        onClose={() => setShowAddMemberDialog(false)}
        onAdded={refreshTeamMembers}
        existingMemberUserIds={teamMembers.map(m => m.user_id)}
      />
    </div>
  );
}
