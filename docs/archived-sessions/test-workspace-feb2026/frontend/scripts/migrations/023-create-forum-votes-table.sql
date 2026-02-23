-- Migration: Create Forum Voting System
-- Part of P3 Forum Improvements - Voting System Implementation
--
-- Run on PostgreSQL database (192.168.1.15) in the forums schema
-- Command: docker exec veritable-games-postgres psql -U postgres -d veritable_games -f /path/to/this/file.sql

-- Set search path to forums schema
SET search_path TO forums;

-- Forum votes table
-- Tracks individual user votes on forum replies (upvote/downvote)
CREATE TABLE IF NOT EXISTS forum_votes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,                -- User who cast the vote
  reply_id INTEGER NOT NULL,               -- Reply being voted on
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')), -- Vote direction
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, reply_id)                -- One vote per user per reply
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_forum_votes_user ON forum_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_votes_reply ON forum_votes(reply_id);
CREATE INDEX IF NOT EXISTS idx_forum_votes_created ON forum_votes(created_at DESC);

-- Add vote_count column to forum_replies if it doesn't exist
-- (SQLite uses vote_score, PostgreSQL will use vote_count)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'forums'
    AND table_name = 'forum_replies'
    AND column_name = 'vote_count'
  ) THEN
    ALTER TABLE forum_replies ADD COLUMN vote_count INTEGER DEFAULT 0;

    -- Migrate existing vote_score to vote_count if vote_score exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'forums'
      AND table_name = 'forum_replies'
      AND column_name = 'vote_score'
    ) THEN
      UPDATE forum_replies SET vote_count = COALESCE(vote_score, 0);
    END IF;
  END IF;
END $$;

-- Create function to update vote counts
CREATE OR REPLACE FUNCTION update_reply_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate vote count for the affected reply
  UPDATE forum_replies
  SET vote_count = (
    SELECT COALESCE(SUM(CASE
      WHEN vote_type = 'up' THEN 1
      WHEN vote_type = 'down' THEN -1
      ELSE 0
    END), 0)
    FROM forum_votes
    WHERE reply_id = COALESCE(NEW.reply_id, OLD.reply_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.reply_id, OLD.reply_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update vote counts when votes change
DROP TRIGGER IF EXISTS trigger_update_reply_vote_count ON forum_votes;
CREATE TRIGGER trigger_update_reply_vote_count
  AFTER INSERT OR UPDATE OR DELETE ON forum_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_reply_vote_count();

-- Verify tables were created
SELECT 'forum_votes' as table_name, COUNT(*) as row_count FROM forum_votes;

-- Show sample of forum_replies with vote_count column
SELECT 'Verification: forum_replies has vote_count column' as status,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'forums'
         AND table_name = 'forum_replies'
         AND column_name = 'vote_count'
       ) as column_exists;
