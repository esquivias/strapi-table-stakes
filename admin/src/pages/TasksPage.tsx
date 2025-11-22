import { useState, useEffect, useCallback } from 'react';
import {
  Main,
  Button,
  Box,
  Flex,
  Typography,
  Badge,
  EmptyStateLayout,
  TextInput,
  DateTimePicker,
  Field,
  SingleSelect,
  SingleSelectOption,
} from '@strapi/design-system';
import { useFetchClient } from '@strapi/strapi/admin';

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

interface ContentType {
  uid: string;
  displayName: string;
}

interface DocumentItem {
  documentId: string;
  id: number;
  [key: string]: any;
}

const TasksPage = () => {
  const { get, post, put, del } = useFetchClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [documentsCache, setDocumentsCache] = useState<Record<string, DocumentItem[]>>({});
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Load tasks and content types on mount and when filters change
  useEffect(() => {
    loadData();
  }, [statusFilter, dateFrom, dateTo]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Build query params for filtering
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      // Load tasks from our plugin with filters
      try {
        const tasksRes = await get(`/strapi-table-stakes/tasks?${params.toString()}`);
        if (tasksRes.data) {
          let filteredTasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];

          // Apply date filters client-side
          if (dateFrom) {
            filteredTasks = filteredTasks.filter((t: Task) => new Date(t.scheduled_at) >= dateFrom);
          }
          if (dateTo) {
            filteredTasks = filteredTasks.filter((t: Task) => new Date(t.scheduled_at) <= dateTo);
          }

          setTasks(filteredTasks);
        }
      } catch (err) {
        console.error('Failed to load tasks:', err);
        // Continue even if tasks fail to load
      }

      // Load content types
      try {
        const ctRes = await get('/content-manager/content-types');
        console.log('Content types response:', ctRes);

        // The response has nested data structure: ctRes.data.data
        const contentTypesData = ctRes.data?.data || ctRes.data || [];
        console.log('Content types data:', contentTypesData);

        if (Array.isArray(contentTypesData)) {
          const apiContentTypes = contentTypesData
            .filter((ct: any) => ct.kind === 'collectionType' && ct.uid.startsWith('api::'))
            .map((ct: any) => ({
              uid: ct.uid,
              displayName: ct.info?.displayName || ct.uid,
            }));
          console.log('Filtered content types:', apiContentTypes);
          setContentTypes(apiContentTypes);
        } else {
          console.error('Content types data is not an array:', contentTypesData);
          setContentTypes([]);
        }
      } catch (err) {
        console.error('Failed to load content types:', err);
        // Set empty array so button isn't disabled
        setContentTypes([]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load documents for a specific content type
  const loadDocuments = useCallback(async (contentType: string) => {
    if (documentsCache[contentType]) {
      console.log(`Documents already cached for ${contentType}:`, documentsCache[contentType]);
      return; // Already loaded
    }

    console.log(`Loading documents for content type: ${contentType}`);
    try {
      const res = await get(`/content-manager/collection-types/${contentType}`);
      console.log(`Documents response for ${contentType}:`, res);

      if (res.data?.results) {
        console.log(`Loaded ${res.data.results.length} documents for ${contentType}`);
        setDocumentsCache(prev => ({
          ...prev,
          [contentType]: res.data.results
        }));
      } else {
        console.warn(`No results found for ${contentType}. Response:`, res);
      }
    } catch (error) {
      console.error(`Failed to load documents for ${contentType}:`, error);
    }
  }, [documentsCache, get]);

  const addNewTask = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const newTask: Task = {
      name: 'New Task',
      documents: [],
      scheduled_at: tomorrow.toISOString(),
      status: 'pending',
    };
    setTasks([...tasks, newTask]);
  };

  const saveTask = async (taskIndex: number) => {
    const task = tasks[taskIndex];

    if (!task.name.trim()) {
      alert('Please enter a task name');
      return;
    }

    try {
      if (task.documentId) {
        // Update existing task
        const res = await put(`/strapi-table-stakes/tasks/${task.documentId}`, {
          name: task.name,
          documents: task.documents,
          scheduled_at: task.scheduled_at,
          status: task.status,
        });
        alert('Task updated!');
      } else {
        // Create new task
        const res = await post('/strapi-table-stakes/tasks', {
          name: task.name,
          documents: task.documents,
          scheduled_at: task.scheduled_at,
          status: 'pending',
        });

        if (res.data) {
          const updatedTasks = [...tasks];
          updatedTasks[taskIndex] = {
            ...task,
            documentId: res.data.documentId,
            id: res.data.id
          };
          setTasks(updatedTasks);
          alert('Task created!');
        }
      }
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('Failed to save task. Check console for details.');
    }
  };

  const removeTask = async (taskIndex: number) => {
    const task = tasks[taskIndex];

    if (task.documentId) {
      if (!confirm('Delete this task?')) return;
      try {
        await del(`/strapi-table-stakes/tasks/${task.documentId}`);
      } catch (error) {
        console.error('Failed to delete task:', error);
        alert('Failed to delete task');
        return;
      }
    }

    setTasks(tasks.filter((_, i) => i !== taskIndex));
  };

  const updateTaskName = (taskIndex: number, name: string) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].name = name;
    setTasks(updatedTasks);
  };

  const updateTaskSchedule = (taskIndex: number, date: Date) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].scheduled_at = date.toISOString();
    setTasks(updatedTasks);
  };

  const addDocumentToTask = (taskIndex: number) => {
    console.log('Adding document to task. Available content types:', contentTypes);

    const newDocument: TaskDocument = {
      content_type: contentTypes[0]?.uid || '',
      document_id: '',
      operation: 'publish',
    };

    console.log('Created new document:', newDocument);

    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].documents.push(newDocument);
    setTasks(updatedTasks);

    // Load documents for the selected content type
    if (newDocument.content_type) {
      console.log('Loading documents for:', newDocument.content_type);
      loadDocuments(newDocument.content_type);
    } else {
      console.warn('No content type available for new document');
    }
  };

  const updateDocumentContentType = (taskIndex: number, docIndex: number, contentType: string) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].documents[docIndex].content_type = contentType;
    updatedTasks[taskIndex].documents[docIndex].document_id = ''; // Reset document selection
    setTasks(updatedTasks);

    // Load documents for the new content type
    loadDocuments(contentType);
  };

  const updateDocumentId = (taskIndex: number, docIndex: number, documentId: string) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].documents[docIndex].document_id = documentId;
    setTasks(updatedTasks);
  };

  const setDocumentOperation = (taskIndex: number, docIndex: number, operation: 'publish' | 'unpublish') => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].documents[docIndex].operation = operation;
    setTasks(updatedTasks);
  };

  const removeDocument = (taskIndex: number, docIndex: number) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex].documents.splice(docIndex, 1);
    setTasks(updatedTasks);
  };

  if (loading) {
    return (
      <Main>
        <Box padding={8}>
          <Typography>Loading...</Typography>
        </Box>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={8}>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={6}>
          <Box>
            <Typography variant="alpha" as="h1">
              Scheduled Tasks
            </Typography>
            <Typography variant="omega" textColor="neutral600">
              Schedule publish and unpublish operations
            </Typography>
          </Box>
          <Button onClick={addNewTask}>
            + New Task
          </Button>
        </Flex>

        {/* Filters */}
        <Box padding={4} background="neutral100" hasRadius marginBottom={6}>
          <Typography variant="sigma" textColor="neutral600" marginBottom={3}>
            FILTERS
          </Typography>
          <Flex gap={4} wrap="wrap">
            <Box style={{ minWidth: '150px' }}>
              <Field.Root>
                <Field.Label>Status</Field.Label>
                <SingleSelect
                  value={statusFilter}
                  onChange={(value: string) => setStatusFilter(value)}
                >
                  <SingleSelectOption value="all">All</SingleSelectOption>
                  <SingleSelectOption value="pending">Pending</SingleSelectOption>
                  <SingleSelectOption value="completed">Completed</SingleSelectOption>
                  <SingleSelectOption value="partial">Partial</SingleSelectOption>
                  <SingleSelectOption value="failed">Failed</SingleSelectOption>
                </SingleSelect>
              </Field.Root>
            </Box>
            <Box style={{ minWidth: '200px' }}>
              <Field.Root>
                <Field.Label>From Date</Field.Label>
                <DateTimePicker
                  value={dateFrom}
                  onChange={(date: Date | undefined) => setDateFrom(date)}
                />
              </Field.Root>
            </Box>
            <Box style={{ minWidth: '200px' }}>
              <Field.Root>
                <Field.Label>To Date</Field.Label>
                <DateTimePicker
                  value={dateTo}
                  onChange={(date: Date | undefined) => setDateTo(date)}
                />
              </Field.Root>
            </Box>
            <Box style={{ alignSelf: 'flex-end' }}>
              <Button
                variant="tertiary"
                onClick={() => {
                  setStatusFilter('pending');
                  setDateFrom(undefined);
                  setDateTo(undefined);
                }}
              >
                Clear Filters
              </Button>
            </Box>
          </Flex>
        </Box>

        {tasks.length === 0 ? (
          <Box paddingTop={11} paddingBottom={11}>
            <EmptyStateLayout
              content={`No tasks found${statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}. ${statusFilter === 'pending' ? 'Create a task to schedule document operations.' : 'Try adjusting your filters.'}`}
              action={
                <Button variant="secondary" onClick={addNewTask}>
                  + Create your first task
                </Button>
              }
            />
          </Box>
        ) : (
          <Flex direction="column" alignItems="stretch" gap={4}>
            {tasks.map((task, taskIndex) => (
              <Box
                key={task.documentId || taskIndex}
                padding={6}
                background="neutral0"
                shadow="tableShadow"
                hasRadius
              >
                <Flex direction="column" alignItems="stretch" gap={4}>
                  {/* Task Header */}
                  <Flex justifyContent="space-between" alignItems="flex-start">
                    <Box style={{ flex: 1 }}>
                      <Field.Root>
                        <Field.Label>Task Name</Field.Label>
                        <TextInput
                          placeholder="Enter task name..."
                          value={task.name}
                          onChange={(e: any) => updateTaskName(taskIndex, e.target.value)}
                        />
                      </Field.Root>
                    </Box>
                    <Flex gap={2} marginLeft={4}>
                      <Badge>{task.status}</Badge>
                      <Button
                        variant="success"
                        size="S"
                        onClick={() => saveTask(taskIndex)}
                      >
                        Save
                      </Button>
                      <Button
                        variant="danger-light"
                        size="S"
                        onClick={() => removeTask(taskIndex)}
                      >
                        Delete
                      </Button>
                    </Flex>
                  </Flex>

                  {/* Schedule Time */}
                  <Field.Root>
                    <Field.Label>Scheduled Time</Field.Label>
                    <DateTimePicker
                      value={new Date(task.scheduled_at)}
                      onChange={(date: Date | undefined) => {
                        if (date) {
                          updateTaskSchedule(taskIndex, date);
                        }
                      }}
                    />
                  </Field.Root>

                  {/* Documents List */}
                  <Box>
                    <Typography variant="delta" marginBottom={2}>
                      Documents ({task.documents.length})
                    </Typography>
                    <Flex direction="column" alignItems="stretch" gap={3}>
                      {task.documents.map((doc, docIndex) => {
                        const docs = documentsCache[doc.content_type] || [];

                        return (
                          <Box
                            key={docIndex}
                            padding={4}
                            background="neutral100"
                            hasRadius
                          >
                            <Flex direction="column" gap={3}>
                              {/* Content Type Selection */}
                              <Field.Root>
                                <Field.Label>Content Type</Field.Label>
                                <SingleSelect
                                  value={doc.content_type}
                                  onChange={(value: string) => updateDocumentContentType(taskIndex, docIndex, value)}
                                >
                                  {contentTypes.map((ct) => (
                                    <SingleSelectOption key={ct.uid} value={ct.uid}>
                                      {ct.displayName}
                                    </SingleSelectOption>
                                  ))}
                                </SingleSelect>
                              </Field.Root>

                              {/* Document Selection */}
                              <Field.Root>
                                <Field.Label>Document</Field.Label>
                                {docs.length > 0 ? (
                                  <SingleSelect
                                    value={doc.document_id}
                                    onChange={(value: string) => updateDocumentId(taskIndex, docIndex, value)}
                                    placeholder="Select a document..."
                                  >
                                    {docs.map((d) => {
                                      // Try to find a good display field
                                      const displayName = d.title || d.name || d.displayName || d.label || `Document ${d.id}`;
                                      return (
                                        <SingleSelectOption key={d.documentId} value={d.documentId}>
                                          {displayName} (ID: {d.documentId})
                                        </SingleSelectOption>
                                      );
                                    })}
                                  </SingleSelect>
                                ) : (
                                  <Typography variant="omega" textColor="neutral600">
                                    {doc.content_type ? 'Loading documents...' : 'Select a content type first'}
                                  </Typography>
                                )}
                              </Field.Root>

                              {/* Operation Selection - Side by Side */}
                              <Box>
                                <Field.Label>Operation</Field.Label>
                                <Flex gap={2} marginTop={1}>
                                  <Button
                                    variant={doc.operation === 'publish' ? 'success' : 'secondary'}
                                    onClick={() => setDocumentOperation(taskIndex, docIndex, 'publish')}
                                    style={{ flex: 1 }}
                                  >
                                    Publish
                                  </Button>
                                  <Button
                                    variant={doc.operation === 'unpublish' ? 'danger' : 'secondary'}
                                    onClick={() => setDocumentOperation(taskIndex, docIndex, 'unpublish')}
                                    style={{ flex: 1 }}
                                  >
                                    Unpublish
                                  </Button>
                                </Flex>
                              </Box>

                              {/* Remove from Task */}
                              <Button
                                variant="danger-light"
                                size="S"
                                onClick={() => removeDocument(taskIndex, docIndex)}
                              >
                                Remove from Task (document will not be deleted)
                              </Button>
                            </Flex>
                          </Box>
                        );
                      })}

                      <Button
                        variant="secondary"
                        onClick={() => addDocumentToTask(taskIndex)}
                      >
                        + Add Document
                      </Button>
                    </Flex>
                  </Box>
                </Flex>
              </Box>
            ))}
          </Flex>
        )}
      </Box>
    </Main>
  );
};

export { TasksPage };
