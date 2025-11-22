import { useState, useEffect } from 'react';
import { Box, Flex, Typography, Button } from '@strapi/design-system';
import { useFetchClient } from '@strapi/strapi/admin';
import { useForm } from '@strapi/admin/strapi-admin';
import { useParams } from 'react-router-dom';

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

const SnapshotsPanelContent = () => {
  const params = useParams<{ slug?: string; id?: string; collectionType?: string }>();
  const { get } = useFetchClient();

  // Access form setValues from the Form context
  const setValues = useForm('SnapshotsPanelContent', (state) => state.setValues);

  const contentType = params.slug || '';
  const docId = params.id || '';

  const [snapshots, setSnapshots] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Audit | null>(null);

  useEffect(() => {
    if (contentType && docId) {
      loadSnapshots();
    }
  }, [contentType, docId]);

  const loadSnapshots = async () => {
    try {
      setLoading(true);
      const res = await get(
        `/strapi-table-stakes/audits?content_type=${contentType}&document_id=${docId}`
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

  const toggleSnapshot = (snapshot: Audit) => {
    if (selectedSnapshot?.id === snapshot.id) {
      setSelectedSnapshot(null);
    } else {
      setSelectedSnapshot(snapshot);
    }
  };

  const revertToSnapshot = (snapshot: Audit, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Reverting to snapshot:', snapshot.snapshot_after);

    // Try to populate form fields, fall back to clipboard if form context unavailable
    try {
      setValues(snapshot.snapshot_after);
    } catch {
      // Panel is outside Form context - copy to clipboard as fallback
      navigator.clipboard.writeText(JSON.stringify(snapshot.snapshot_after, null, 2));
      console.log('Form context unavailable - copied snapshot to clipboard');
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

  if (loading) {
    return <Typography>Loading snapshots...</Typography>;
  }

  if (snapshots.length === 0) {
    return (
      <Typography variant="omega" textColor="neutral600">
        No snapshots available for this document.
      </Typography>
    );
  }

  return (
    <Flex direction="column" alignItems="stretch" gap={3}>
      {snapshots.map((snapshot) => (
        <Box
          key={snapshot.id}
          padding={3}
          background={selectedSnapshot?.id === snapshot.id ? 'primary100' : 'neutral100'}
          hasRadius
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSnapshot(snapshot)}
        >
          <Flex direction="column" gap={2}>
            <Flex justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="pi" fontWeight="bold">
                  {snapshot.operation}
                </Typography>
                <Typography variant="omega" textColor="neutral600">
                  {formatDate(snapshot.createdAt)}
                </Typography>
              </Box>
            </Flex>

            {snapshot.snapshot_after && (
              <Box marginTop={1}>
                <Typography variant="omega" textColor="neutral600">
                  {Object.keys(snapshot.snapshot_after).length} fields stored
                </Typography>
              </Box>
            )}

            {selectedSnapshot?.id === snapshot.id && (
              <Box marginTop={2}>
                <Button
                  variant="secondary"
                  size="S"
                  fullWidth
                  onClick={(e: React.MouseEvent) => revertToSnapshot(snapshot, e)}
                >
                  Populate form with this snapshot
                </Button>
                <Box marginTop={2} padding={2} background="neutral0" hasRadius>
                  <Typography variant="pi" fontWeight="bold" marginBottom={2}>
                    Snapshot Data:
                  </Typography>
                  <Box
                    style={{
                      maxHeight: '200px',
                      overflow: 'auto',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {JSON.stringify(snapshot.snapshot_after, null, 2)}
                  </Box>
                </Box>
              </Box>
            )}
          </Flex>
        </Box>
      ))}
    </Flex>
  );
};

// Panel component that returns { title, content } or null
export const SnapshotsPanel = () => {
  const { collectionType, id } = useParams<{ collectionType?: string; id?: string }>();

  // Don't show panel when creating new entry
  if (!id || id === 'create') {
    return null;
  }

  // Don't show for single types without an id
  if (collectionType === 'single-types' && !id) {
    return null;
  }

  return {
    title: 'Snapshots',
    content: <SnapshotsPanelContent />,
  };
};

// Label for the panel (following review-workflows pattern)
(SnapshotsPanel as any).type = 'snapshots';
