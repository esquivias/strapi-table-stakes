import { useState, useEffect } from 'react';
import { Box, Flex, Typography, Button, Modal, Loader } from '@strapi/design-system';
import { ClockCounterClockwise } from '@strapi/icons';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { unstable_useDocumentActions as useDocumentActions } from '@strapi/content-manager/strapi-admin';

interface Audit {
  id: number;
  documentId: string;
  content_type: string;
  target_document_id: string;
  operation: string;
  snapshot_before: any;
  snapshot_after: any;
  createdAt: string;
}

interface RestoreSnapshotModalProps {
  onClose: () => void;
  model: string;
  documentId: string;
}

const RestoreSnapshotModal = ({ onClose, model, documentId }: RestoreSnapshotModalProps) => {
  const { get } = useFetchClient();
  const { update } = useDocumentActions();
  const { toggleNotification } = useNotification();

  const [snapshots, setSnapshots] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Audit | null>(null);

  useEffect(() => {
    loadSnapshots();
  }, [model, documentId]);

  const loadSnapshots = async () => {
    try {
      setLoading(true);
      const res = await get(
        `/strapi-table-stakes/audits?content_type=${model}&document_id=${documentId}`
      );
      const audits = Array.isArray(res.data) ? res.data : [];
      const snapshotsWithData = audits.filter(
        (audit: Audit) => audit.snapshot_after && Object.keys(audit.snapshot_after).length > 0
      );
      setSnapshots(snapshotsWithData);
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRestore = async () => {
    if (!selectedSnapshot) return;

    try {
      setRestoring(true);

      // Use the document actions API to update the document
      await update(
        {
          collectionType: model.startsWith('api::') ? 'collection-types' : 'single-types',
          model,
          documentId,
        },
        selectedSnapshot.snapshot_after
      );

      toggleNotification({
        type: 'success',
        message: 'Document restored from snapshot',
      });

      onClose();

      // Reload page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      toggleNotification({
        type: 'danger',
        message: 'Failed to restore snapshot',
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <Modal.Body>
        {loading ? (
          <Flex justifyContent="center" padding={6}>
            <Loader>Loading snapshots...</Loader>
          </Flex>
        ) : snapshots.length === 0 ? (
          <Typography textColor="neutral600">
            No snapshots available for this document.
          </Typography>
        ) : (
          <Flex direction="column" gap={3}>
            <Typography variant="omega" textColor="neutral600">
              Select a snapshot to restore:
            </Typography>
            {snapshots.map((snapshot) => (
              <Box
                key={snapshot.id}
                padding={3}
                background={selectedSnapshot?.id === snapshot.id ? 'primary100' : 'neutral100'}
                hasRadius
                style={{ cursor: 'pointer', border: selectedSnapshot?.id === snapshot.id ? '2px solid var(--colors-primary600)' : '2px solid transparent' }}
                onClick={() => setSelectedSnapshot(snapshot)}
              >
                <Flex justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="pi" fontWeight="bold">
                      {snapshot.operation}
                    </Typography>
                    <Typography variant="omega" textColor="neutral600">
                      {formatDate(snapshot.createdAt)}
                    </Typography>
                  </Box>
                  <Typography variant="omega" textColor="neutral600">
                    {Object.keys(snapshot.snapshot_after).length} fields
                  </Typography>
                </Flex>

                {/* Show expanded JSON when selected */}
                {selectedSnapshot?.id === snapshot.id && (
                  <Box
                    marginTop={3}
                    padding={3}
                    background="neutral0"
                    hasRadius
                    style={{
                      maxHeight: '300px',
                      overflow: 'auto',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {JSON.stringify(snapshot.snapshot_after, null, 2)}
                  </Box>
                )}
              </Box>
            ))}
          </Flex>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Modal.Close>
          <Button variant="tertiary">Cancel</Button>
        </Modal.Close>
        <Button
          onClick={handleRestore}
          disabled={!selectedSnapshot || restoring}
          loading={restoring}
        >
          Restore Selected Snapshot
        </Button>
      </Modal.Footer>
    </>
  );
};

// Document Action component
interface RestoreSnapshotActionProps {
  model: string;
  document: any;
  documentId?: string;
}

export const RestoreSnapshotAction = ({ model, document, documentId }: RestoreSnapshotActionProps) => {
  // Don't show action for new documents
  if (!document || !documentId) {
    return null;
  }

  // Only show for user-created content types
  if (!model.startsWith('api::')) {
    return null;
  }

  return {
    label: 'Restore Snapshot',
    icon: <ClockCounterClockwise />,
    dialog: {
      type: 'modal' as const,
      title: 'Restore from Snapshot',
      content: ({ onClose }: { onClose: () => void }) => (
        <RestoreSnapshotModal
          onClose={onClose}
          model={model}
          documentId={documentId}
        />
      ),
    },
    position: 'panel',
    variant: 'secondary' as const,
  };
};

RestoreSnapshotAction.type = 'restore-snapshot';
RestoreSnapshotAction.position = 'panel';
