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

interface TasksSidePanelProps {
  model?: string; // Content type UID (e.g., 'api::article.article')
  documentId?: string; // Current document ID
  slug?: string; // Alternative name for model from content manager
  id?: string; // Alternative name for documentId from content manager
}

export const TasksSidePanel = ({ model, documentId, slug, id }: TasksSidePanelProps) => {
  // Get document ID from URL params if not passed as props
  const params = useParams<{ id?: string }>();

  // Content manager may pass slug/id instead of model/documentId
  const contentType = model || slug || '';
  const docId = documentId || id || params.id || '';

  console.log('TasksSidePanel props:', { model, documentId, slug, id, params, contentType, docId });

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
  const { get, put } = useFetchClient();
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedOperation, setSelectedOperation] = useState<'publish' | 'unpublish'>('publish');
  const [tasksWithDocument, setTasksWithDocument] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingTasks();
  }, [contentType, docId]);

  const loadPendingTasks = async () => {
    try {
      setLoading(true);
      console.log('Loading pending tasks for:', { contentType, docId });

      // Load all pending tasks
      const res = await get('/strapi-table-stakes/tasks?status=pending');
      const tasks = Array.isArray(res.data) ? res.data : [];
      console.log('Loaded pending tasks:', tasks);

      setPendingTasks(tasks);

      // Find tasks that contain this document
      const tasksWithDoc = tasks.filter((task: Task) =>
        task.documents.some(
          (doc) => doc.content_type === contentType && doc.document_id === docId
        )
      );
      console.log('Tasks containing this document:', tasksWithDoc);
      setTasksWithDocument(tasksWithDoc);
    } catch (error) {
      console.error('Failed to load pending tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToTask = async () => {
    if (!selectedTaskId) {
      alert('Please select a task');
      return;
    }

    try {
      const task = pendingTasks.find((t) => t.documentId === selectedTaskId);
      if (!task) return;

      // Check if document already in task
      const alreadyInTask = task.documents.some(
        (doc) => doc.content_type === contentType && doc.document_id === docId
      );

      if (alreadyInTask) {
        alert('This document is already in the selected task');
        return;
      }


      // Add document to task
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

      alert(`Document added to task: ${task.name}`);
      loadPendingTasks(); // Reload to update the list
      setSelectedTaskId('');
    } catch (error) {
      console.error('Failed to add document to task:', error);
      alert('Failed to add document to task');
    }
  };

  const removeFromTask = async (task: Task) => {
    if (!confirm(`Remove this document from "${task.name}"?`)) return;

    try {
      // Filter out this document
      const updatedDocuments = task.documents.filter(
        (doc) => !(doc.content_type === contentType && doc.document_id === docId)
      );

      await put(`/strapi-table-stakes/tasks/${task.documentId}`, {
        name: task.name,
        documents: updatedDocuments,
        scheduled_at: task.scheduled_at,
        status: task.status,
      });

      alert('Document removed from task');
      loadPendingTasks(); // Reload to update the list
    } catch (error) {
      console.error('Failed to remove document from task:', error);
      alert('Failed to remove document from task');
    }
  };

  const updateOperation = async (task: Task, newOperation: 'publish' | 'unpublish') => {
    try {
      // Update the operation for this document in the task
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

      alert('Operation updated');
      loadPendingTasks(); // Reload to update the list
    } catch (error) {
      console.error('Failed to update operation:', error);
      alert('Failed to update operation');
    }
  };

  if (loading) {
    return (
      <Box padding={4}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box padding={4}>
      <Typography variant="sigma" textColor="neutral600" marginBottom={2}>
        SCHEDULED TASKS
      </Typography>

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
              IN TASKS ({tasksWithDocument.length})
            </Typography>

            <Flex direction="column" alignItems="stretch" gap={3}>
              {tasksWithDocument.map((task) => {
                const doc = task.documents.find(
                  (d) => d.content_type === contentType && d.document_id === docId
                );
                if (!doc) return null;

                return (
                  <Box
                    key={task.documentId}
                    padding={3}
                    background="neutral100"
                    hasRadius
                  >
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
