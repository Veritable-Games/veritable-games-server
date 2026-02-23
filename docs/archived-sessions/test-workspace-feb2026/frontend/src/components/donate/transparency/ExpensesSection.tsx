'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { fetchJSON } from '@/lib/utils/csrf';
import type { Expense, ExpenseCategory } from '@/lib/donations/types';
import { InlineExpenseForm } from './InlineExpenseForm';
import { exportExpenses } from '@/lib/utils/csv-export';
import { logger } from '@/lib/utils/logger';

export const ExpensesSection = forwardRef(function ExpensesSection(_props, ref) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

  useEffect(() => {
    Promise.all([fetchExpenses(), fetchCategories()]);
  }, [selectedCategory, selectedYear]);

  async function fetchExpenses() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category_id', selectedCategory.toString());
      if (selectedYear !== 'all') params.append('year', selectedYear.toString());

      const response = await fetch(`/api/admin/expenses?${params}`);
      const result = await response.json();

      if (result.success) {
        setExpenses(result.data || []);
      } else {
        setError(result.error || 'Failed to load expenses');
      }
    } catch (err) {
      setError('Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const response = await fetch('/api/admin/expenses/categories');
      const result = await response.json();
      if (result.success) {
        setCategories(result.data || []);
      }
    } catch (err) {
      logger.error('Failed to fetch categories:', err);
    }
  }

  async function handleCreate(data: any) {
    try {
      const result = await fetchJSON('/api/admin/expenses', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (result.success) {
        setCreatingNew(false);
        await fetchExpenses();
      } else {
        alert(result.error || 'Failed to create expense');
      }
    } catch (err: any) {
      logger.error('Error creating expense:', err);
      alert(err.message || 'Failed to create expense');
    }
  }

  async function handleUpdate(expenseId: number, data: any) {
    try {
      const result = await fetchJSON(`/api/admin/expenses/${expenseId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (result.success) {
        setEditingId(null);
        await fetchExpenses();
      } else {
        alert(result.error || 'Failed to update expense');
      }
    } catch (err: any) {
      logger.error('Error updating expense:', err);
      alert(err.message || 'Failed to update expense');
    }
  }

  async function handleDelete(expenseId: number) {
    if (!confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    try {
      const result = await fetchJSON(`/api/admin/expenses/${expenseId}`, {
        method: 'DELETE',
      });

      if (result.success) {
        await fetchExpenses();
      } else {
        alert(result.error || 'Failed to delete expense');
      }
    } catch (err: any) {
      logger.error('Error deleting expense:', err);
      alert(err.message || 'Failed to delete expense');
    }
  }

  async function handleExport() {
    await exportExpenses({
      categoryId: selectedCategory === 'all' ? undefined : selectedCategory,
      year: selectedYear === 'all' ? undefined : selectedYear,
    });
  }

  useImperativeHandle(ref, () => ({
    handleExport,
  }));

  // Get unique years from expenses
  const years = Array.from(new Set(expenses.map(e => new Date(e.expense_date).getFullYear()))).sort(
    (a, b) => b - a
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-lg text-neutral-400">Loading expenses...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-700/40 bg-red-900/20 p-6 text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e =>
              setSelectedCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="rounded-md border border-neutral-700 bg-neutral-800/50 px-4 py-2 text-sm text-white transition-colors hover:border-neutral-600 focus:border-[#60a5fa] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/20"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={e =>
              setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="rounded-md border border-neutral-700 bg-neutral-800/50 px-4 py-2 text-sm text-white transition-colors hover:border-neutral-600 focus:border-[#60a5fa] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/20"
          >
            <option value="all">All Years</option>
            {years.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Create Button */}
        <button
          onClick={() => setCreatingNew(true)}
          disabled={creatingNew}
          className="rounded-md bg-[#60a5fa] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#60a5fa]/90 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          + Create Expense
        </button>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-lg border border-neutral-700/40">
        <table className="w-full">
          <thead className="bg-neutral-800/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">Date</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">
                Category
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">
                Description
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">Amount</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">
                Receipt
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-neutral-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700/40 bg-neutral-800/30">
            {/* Inline Create Form */}
            {creatingNew && (
              <InlineExpenseForm
                mode="create"
                onSave={handleCreate}
                onCancel={() => setCreatingNew(false)}
              />
            )}

            {/* Expense Rows */}
            {expenses.length === 0 && !creatingNew ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-neutral-400">
                  <div className="inline-flex flex-col items-center gap-2">
                    <svg
                      className="h-12 w-12 text-neutral-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-lg">No expenses yet</p>
                    <p className="text-sm">Create one to get started</p>
                  </div>
                </td>
              </tr>
            ) : (
              expenses.map(expense =>
                editingId === expense.id ? (
                  <InlineExpenseForm
                    key={expense.id}
                    mode="edit"
                    expense={expense}
                    onSave={data => handleUpdate(expense.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    categories={categories}
                    onClick={() => setEditingId(expense.id)}
                    onDelete={() => handleDelete(expense.id)}
                  />
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

interface ExpenseRowProps {
  expense: Expense;
  categories: ExpenseCategory[];
  onClick: () => void;
  onDelete: () => void;
}

function ExpenseRow({ expense, categories, onClick, onDelete }: ExpenseRowProps) {
  const category = categories.find(c => c.id === expense.category_id);

  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-neutral-700/30"
      onClick={onClick}
      title="Click to edit"
    >
      <td className="px-6 py-4 text-sm text-neutral-400">
        {new Date(expense.expense_date).toLocaleDateString()}
      </td>
      <td className="px-6 py-4">
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
          style={{
            backgroundColor: category?.color ? `${category.color}20` : '#374151',
            color: category?.color || '#9ca3af',
          }}
        >
          {category?.name || 'Unknown'}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-white">{expense.description}</td>
      <td className="px-6 py-4 text-sm font-semibold text-white">
        ${expense.amount.toFixed(2)} {expense.currency}
      </td>
      <td className="px-6 py-4">
        {expense.receipt_url ? (
          <a
            href={expense.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-sm text-[#60a5fa] transition-colors hover:text-[#60a5fa]/80 hover:underline"
          >
            View
          </a>
        ) : (
          <span className="text-sm text-neutral-500">-</span>
        )}
      </td>
      <td className="px-6 py-4">
        <button
          onClick={e => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-md border border-red-700/40 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:border-red-600/60 hover:bg-red-900/30"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
