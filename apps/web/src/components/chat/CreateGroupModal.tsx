'use client';

import React, { useState } from 'react';
import { X, Users, Search, Check } from 'lucide-react';
import { ChatUser } from '@/types/chat';

interface CreateGroupModalProps {
  friends: ChatUser[];
  onClose: () => void;
  onCreateGroup: (title: string, memberIds: string[]) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  friends,
  onClose,
  onCreateGroup,
}) => {
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const filteredFriends = friends.filter((f) => {
    const n = f.displayName || f.name || '';
    return (
      n.toLowerCase().includes(search.toLowerCase()) ||
      (f.username && f.username.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const toggleSelect = (userId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim() || selectedFriends.length === 0) return;
    onCreateGroup(groupTitle.trim(), selectedFriends);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 text-[#ee1d49] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Create New Group
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-4 space-y-4">
          {/* Group Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
              Group Name
            </label>
            <input
              type="text"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="e.g. Cinema Squad, Binge Watchers..."
              required
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-sm text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-[#ee1d49]/40"
            />
          </div>

          {/* Search Friends */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5 flex items-center justify-between">
              <span>Add Participants</span>
              <span className="text-[#ee1d49]">
                {selectedFriends.length} selected
              </span>
            </label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search friends..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs text-slate-900 dark:text-white outline-hidden"
              />
            </div>

            {/* Friends list with checkboxes */}
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {filteredFriends.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400">No friends found</p>
              ) : (
                filteredFriends.map((friend) => {
                  const isChecked = selectedFriends.includes(friend.id);
                  return (
                    <div
                      key={friend.id}
                      onClick={() => toggleSelect(friend.id)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                        isChecked
                          ? 'bg-rose-50/70 dark:bg-rose-950/30 text-[#ee1d49]'
                          : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs">
                          {friend.avatar ? (
                            <img src={friend.avatar} alt={friend.displayName || friend.name || 'Friend'} className="w-full h-full object-cover" />
                          ) : (
                            (friend.displayName || friend.name || 'F').slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold truncate">{friend.displayName || friend.name}</p>
                          {friend.username && (
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                              @{friend.username}
                            </p>
                          )}
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                          isChecked
                            ? 'bg-[#ee1d49] border-[#ee1d49] text-white'
                            : 'border-slate-300 dark:border-zinc-700'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!groupTitle.trim() || selectedFriends.length === 0}
              className="flex-1 py-2.5 rounded-2xl bg-[#ee1d49] hover:bg-[#d61840] disabled:opacity-50 text-xs font-bold text-white shadow-xs transition"
            >
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
