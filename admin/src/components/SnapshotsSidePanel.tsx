import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Typography,
  Button,
  Divider,
} from '@strapi/design-system';
import { useFetchClient } from '@strapi/strapi/admin';
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

interface SnapshotsSidePanelProps {
  model?: string;
  documentId?: string;
  slug?: string;
  id?: string;
  onChange?: (data: any) => void; // Callback to update form data
}

export const SnapshotsSidePanel = ({ model, documentId, slug, id, onChange }: SnapshotsSidePanelProps) => {
  const params = useParams<{ id?: string }>();
  const { get } = useFetchClient();

  const contentType = model || slug || '';
  const docId = documentId || id || params.id || '';

  const [snapshots, setSnapshots] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Audit | null>(null);

  console.log('SnapshotsSidePanel props:', { model, documentId, slug, id, params, contentType, docId });

  useEffect(() => {
    if (contentType && docId) {
      loadSnapshots();
    }
  }, [contentType, docId]);

  const loadSnapshots = async () => {
    try {
      setLoading(true);
      console.log('Loading snapshots for:', { contentType, docId });

      // Load audits for this document from the audit log
      const res = await get(`/strapi-table-stakes/audits?content_type=${contentType}&document_id=${docId}`);
      const audits = Array.isArray(res.data) ? res.data : [];

      // Filter to only audits that have snapshot data
      const snapshotsWithData = audits.filter((audit: Audit) => audit.snapshot_after && Object.keys(audit.snapshot_after).length > 0);

      console.log('Loaded snapshots:', snapshotsWithData);
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

  if (!contentType) {
    return (
      <Box padding={4}>
        <Typography variant="omega" textColor="neutral600">
          No content type detected
        </Typography>
      </Box>
    );
  }

  if (!docId) {
    return (
      <Box padding={4}>
        <Typography variant="omega" textColor="neutral600">
          Document not saved yet
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box padding={4}>
        <Typography>Loading snapshots...</Typography>
      </Box>
    );
  }

  return (
    <Box padding={4}>
      <Typography variant="sigma" textColor="neutral600" marginBottom={2}>
        SNAPSHOTS
      </Typography>

      {snapshots.length === 0 ? (
        <Typography variant="omega" textColor="neutral600">
          No snapshots available for this document.
        </Typography>
      ) : (
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

                {/* Show summary of what's in the snapshot */}
                {snapshot.snapshot_after && (
                  <Box marginTop={1}>
                    <Typography variant="omega" textColor="neutral600">
                      {Object.keys(snapshot.snapshot_after).length} fields stored
                    </Typography>
                  </Box>
                )}

                {/* Show expanded data when selected */}
                {selectedSnapshot?.id === snapshot.id && (
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
                )}
              </Flex>
            </Box>
          ))}
        </Flex>
      )}

    </Box>
  );
};
