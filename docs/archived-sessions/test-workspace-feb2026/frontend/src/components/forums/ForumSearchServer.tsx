import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

interface Category {
  id: number;
  name: string;
  description?: string;
  color?: string;
  sort_order?: number;
  section?: string;
}

interface ForumSearchServerProps {
  children: (categories: Category[]) => React.ReactNode;
}

async function getCategories(): Promise<Category[]> {
  try {
    const result = await dbAdapter.query(
      `SELECT id, name, description, color, sort_order, section
       FROM forum_categories
       ORDER BY sort_order ASC, name ASC`,
      [],
      { schema: 'forums' }
    );

    return result.rows as Category[];
  } catch (error) {
    logger.error('Error loading categories:', error);
    return [];
  }
}

export async function ForumSearchServer({ children }: ForumSearchServerProps) {
  const categories = await getCategories();

  return <>{children(categories)}</>;
}

export type { Category };
