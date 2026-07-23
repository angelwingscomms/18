export type RemoteNote = { u: number };

export type SyncAction =
	| { type: 'create_local' }
	| { type: 'adopt_remote' }
	| { type: 'push_local' }
	| { type: 'noop' };

/** Decide what a local note should do given the remote copy the server returned
 *  for the same id (or undefined if the remote has no such note yet). Last-write-wins by `u`. */
export function reconcile_note(
	local: RemoteNote | undefined,
	remote: RemoteNote | undefined
): SyncAction {
	if (!local && remote) return { type: 'create_local' };
	if (local && !remote) return { type: 'push_local' };
	if (local && remote) {
		if (remote.u > local.u) return { type: 'adopt_remote' };
		if (local.u > remote.u) return { type: 'push_local' };
		return { type: 'noop' };
	}
	return { type: 'noop' };
}

/** Decide whether a remote tombstone should delete the local copy. Never removes the
 *  last remaining note, and only wins if the tombstone is strictly newer than the local edit. */
export function reconcile_tombstone(
	local: RemoteNote | undefined,
	tombstone_u: number,
	local_note_count: number
): 'remove_local' | 'noop' {
	if (local && local_note_count > 1 && tombstone_u > local.u) return 'remove_local';
	return 'noop';
}
