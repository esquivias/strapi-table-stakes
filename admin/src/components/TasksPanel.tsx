import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Typography,
  Button,
  Field,
  SingleSelect,
  SingleSelectOption,
  Divider,
} from '@strapi/design-system';
import { useFetchClient } from '@strapi/strapi/admin';
import { useParams } from 'react-router-dom';

interface TaskDocument {
  content_type: string;
  document_id: string;
  operation: 'publish' | 'unpublish';
  locale?: string;
}

interface Task {
  id?: number;
  documentId?: string;
  name: string;
  documents: TaskDocument[];
  scheduled_at: string;
  status: 'pending' | 'completed' | 'partial' | 'failed';
}

const TasksPanelContent = () => {
  const params = useParams<{ slug?: string; id?: string; collectionType?: string }>();
  const { get, put } = useFetchClient();

  const contentType = params.slug || '';
  const docId = params.id || '';

  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedOperation, setSelectedOperation] = useState<'publish' | 'unpublish'>('publish');
  const [tasksWithDocument, setTasksWithDocument] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contentType && docId) {
      loadPendingTasks();
    }
  }, [contentType, docId]);

  const loadPendingTasks = async () => {
    try {
      setLoading(true);
      const res = await get('/strapi-table-stakes/tasks?status=pending');
      const tasks = Array.isArray(res.data) ? res.data : [];

      // Filter to only show tasks scheduled in the future
      const now = new Date();
      const upcomingTasks = tasks.filter((task: Task) => new Date(task.scheduled_at) > now);
      setPendingTasks(upcomingTasks);

      const tasksWithDoc = upcomingTasks.filter((task: Task) =>
        task.documents.some(
          (doc) => doc.content_type === contentType && doc.document_id === docId
        )
      );
      setTasksWithDocument(tasksWithDoc);
    } catch (error) {
      console.error('Failed to load pending tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToTask = async () => {
    if (!selectedTaskId) return;

    try {
      const task = pendingTasks.find((t) => t.documentId === selectedTaskId);
      if (!task) return;

      const alreadyInTask = task.documents.some(
        (doc) => doc.content_type === contentType && doc.document_id === docId
      );

      if (alreadyInTask) return;

      const updatedDocuments = [
        ...task.documents,
        {
          content_type: contentType,
          document_id: docId,
          operation: selectedOperation,
        },
      ];

      await put(`/strapi-table-stakes/tasks/${task.documentId}`, {
        name: task.name,
        documents: updatedDocuments,
        scheduled_at: task.scheduled_at,
        status: task.status,
      });

      loadPendingTasks();
      setSelectedTaskId('');
    } catch (error) {
      console.error('Failed to add document to task:', error);
    }
  };

  const removeFromTask = async (task: Task) => {
    try {
      const updatedDocuments = task.documents.filter(
        (doc) => !(doc.content_type === contentType && doc.document_id === docId)
      );

      await put(`/strapi-table-stakes/tasks/${task.documentId}`, {
        name: task.name,
        documents: updatedDocuments,
        scheduled_at: task.scheduled_at,
        status: task.status,
      });

      loadPendingTasks();
    } catch (error) {
      console.error('Failed to remove document from task:', error);
    }
  };

  const updateOperation = async (task: Task, newOperation: 'publish' | 'unpublish') => {
    try {
      const updatedDocuments = task.documents.map((doc) => {
        if (doc.content_type === contentType && doc.document_id === docId) {
          return { ...doc, operation: newOperation };
        }
        return doc;
      });

      await put(`/strapi-table-stakes/tasks/${task.documentId}`, {
        name: task.name,
        documents: updatedDocuments,
        scheduled_at: task.scheduled_at,
        status: task.status,
      });

      loadPendingTasks();
    } catch (error) {
      console.error('Failed to update operation:', error);
    }
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      {/* Add to Task Section */}
      <Box marginBottom={4}>
        <Field.Root>
          <Field.Label>Add to Task</Field.Label>
          <SingleSelect
            value={selectedTaskId}
            onChange={(value: string) => setSelectedTaskId(value)}
            placeholder="Select a task..."
          >
            {pendingTasks
              .filter(
                (task) =>
                  !task.documents.some(
                    (doc) => doc.content_type === contentType && doc.document_id === docId
                  )
              )
              .map((task) => (
                <SingleSelectOption key={task.documentId} value={task.documentId || ''}>
                  {task.name}
                </SingleSelectOption>
              ))}
          </SingleSelect>
        </Field.Root>

        {selectedTaskId && (
          <Box marginTop={2}>
            <Field.Label>Operation</Field.Label>
            <Flex gap={2} marginTop={1}>
              <Button
                variant={selectedOperation === 'publish' ? 'success' : 'secondary'}
                onClick={() => setSelectedOperation('publish')}
                size="S"
                style={{ flex: 1 }}
              >
                Publish
              </Button>
              <Button
                variant={selectedOperation === 'unpublish' ? 'danger' : 'secondary'}
                onClick={() => setSelectedOperation('unpublish')}
                size="S"
                style={{ flex: 1 }}
              >
                Unpublish
              </Button>
            </Flex>
          </Box>
        )}

        {selectedTaskId && (
          <Button onClick={addToTask} variant="default" size="S" marginTop={2} fullWidth>
            Add to Task
          </Button>
        )}
      </Box>

      {/* Tasks containing this document */}
      {tasksWithDocument.length > 0 && (
        <>
          <Divider marginTop={2} marginBottom={2} />
          <Box marginTop={4}>
            <Typography variant="sigma" textColor="neutral600" marginBottom={2}>
              UPCOMING TASKS ({tasksWithDocument.length})
            </Typography>

            <Flex direction="column" alignItems="stretch" gap={3}>
              {tasksWithDocument.map((task) => {
                const doc = task.documents.find(
                  (d) => d.content_type === contentType && d.document_id === docId
                );
                if (!doc) return null;

                return (
                  <Box key={task.documentId} padding={3} background="neutral100" hasRadius>
                    <Typography variant="pi" fontWeight="bold" marginBottom={2}>
                      {task.name}
                    </Typography>

                    <Box marginTop={2} marginBottom={2}>
                      <Field.Label>Operation</Field.Label>
                      <Flex gap={2} marginTop={1}>
                        <Button
                          variant={doc.operation === 'publish' ? 'success' : 'secondary'}
                          onClick={() => updateOperation(task, 'publish')}
                          size="S"
                          style={{ flex: 1 }}
                        >
                          Publish
                        </Button>
                        <Button
                          variant={doc.operation === 'unpublish' ? 'danger' : 'secondary'}
                          onClick={() => updateOperation(task, 'unpublish')}
                          size="S"
                          style={{ flex: 1 }}
                        >
                          Unpublish
                        </Button>
                      </Flex>
                    </Box>

                    <Button
                      variant="danger-light"
                      size="S"
                      onClick={() => removeFromTask(task)}
                      fullWidth
                    >
                      Remove from Task
                    </Button>
                  </Box>
                );
              })}
            </Flex>
          </Box>
        </>
      )}

      {pendingTasks.length === 0 && (
        <Typography variant="omega" textColor="neutral600">
          No pending tasks available. Create a task first.
        </Typography>
      )}
    </Box>
  );
};

// Panel component that returns { title, content } or null
export const TasksPanel = () => {
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
    title: 'Upcoming Tasks',
    content: <TasksPanelContent />,
  };
};

// Label for the panel
(TasksPanel as any).type = 'scheduled-tasks';
