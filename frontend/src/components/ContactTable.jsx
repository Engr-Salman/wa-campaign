import React, { useState } from 'react';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const statusBadge = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  sent: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  invalid: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  skipped: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

export default function ContactTable({ contacts, onRemove, readOnly }) {
  const [page, setPage] = useState(0);
  const perPage = 20;
  const totalPages = Math.ceil(contacts.length / perPage);
  const pageContacts = contacts.slice(page * perPage, (page + 1) * perPage);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 font-medium text-gray-500">#</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Phone</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Name</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
              {!readOnly && (
                <th className="text-left py-2 px-3 font-medium text-gray-500">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageContacts.map((contact, idx) => (
              <tr
                key={contact.id || idx}
                className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
              >
                <td className="py-2 px-3 text-gray-400">
                  {contact.row_number || page * perPage + idx + 1}
                </td>
                <td className="py-2 px-3 font-mono">{contact.phone_number}</td>
                <td className="py-2 px-3">{contact.name || '-'}</td>
                <td className="py-2 px-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      statusBadge[contact.status] || statusBadge.pending
                    }`}
                  >
                    {contact.status}
                  </span>
                  {contact.error_message && (
                    <span className="ml-2 text-xs text-red-400">
                      {contact.error_message}
                    </span>
                  )}
                </td>
                {!readOnly && (
                  <td className="py-2 px-3">
                    {contact.status === 'pending' && (
                      <button
                        onClick={() => onRemove(idx + page * perPage)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-gray-500">
            Page {page + 1} of {totalPages} ({contacts.length} contacts)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary py-1 px-2 disabled:opacity-50"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary py-1 px-2 disabled:opacity-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
