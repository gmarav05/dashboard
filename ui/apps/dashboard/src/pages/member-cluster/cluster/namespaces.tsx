/*
Copyright 2026 The Karmada Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import {
  App,
  Button,
  Drawer,
  Input,
  Space,
  Table,
  TableColumnProps,
  Tag,
  Tooltip,
} from 'antd';
import { Icons } from '@/components/icons';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMemberClusterContext } from '@/hooks';
import {
  Namespace,
  GetMemberClusterNamespaces,
  GetMemberClusterNamespaceDetail,
} from '@/services/member-cluster/namespace';
import dayjs from 'dayjs';
import { stringify, parse } from 'yaml';
import Editor from '@monaco-editor/react';
import { GetResource, PutResource } from '@/services/member-cluster/unstructured';

export default function MemberClusterNamespaces() {
  const { message: messageApi } = App.useApp();
  const { memberClusterName } = useMemberClusterContext();

  const [filter, setFilter] = useState<{ searchText: string }>({
    searchText: '',
  });

  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<Namespace | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['GetMemberClusterNamespaces', memberClusterName, filter],
    queryFn: async () => {
      const ret = await GetMemberClusterNamespaces({
        memberClusterName,
        keyword: filter.searchText,
      });
      return ret.data;
    },
  });

  const getStatusTag = (phase: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      Active: { color: 'success', icon: <Icons.folder width={16} height={16} /> },
      Terminating: { color: 'error', icon: <Icons.exclamation width={16} height={16} /> },
    };

    const config =
      statusConfig[phase] || { color: 'default', icon: <Icons.folder width={16} height={16} /> };

    return (
      <Tag color={config.color} icon={config.icon} className="inline-flex items-center gap-1.5">
        {phase}
      </Tag>
    );
  };

  const getSkipAutoPropagationTag = (skip: boolean) => (
    <Tag color={skip ? 'default' : 'blue'}>
      {skip ? 'Skipped' : 'Propagated'}
    </Tag>
  );

  const formatLabels = (ns: Namespace) => {
    const labels = ns.objectMeta.labels || {};
    const entries = Object.entries(labels);
    if (!entries.length) {
      return <span className="text-gray-400">None</span>;
    }
    const first = `${entries[0][0]}=${entries[0][1]}`;
    const remaining = entries.length - 1;

    if (entries.length === 1) {
      return (
        <Tag color="geekblue" className="text-xs">
          {first}
        </Tag>
      );
    }

    const full = entries.map(([k, v]) => `${k}=${v}`).join(', ');
    return (
      <Tooltip title={full}>
        <div className="flex items-center gap-1">
          <Tag color="geekblue" className="text-xs">
            {first}
          </Tag>
          <Tag color="purple">+{remaining}</Tag>
        </div>
      </Tooltip>
    );
  };

  const columns: TableColumnProps<Namespace>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: Namespace) => (
        <strong>{record.objectMeta.name}</strong>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'phase',
      key: 'phase',
      render: (_: string, record: Namespace) => getStatusTag(record.phase),
    },
    {
      title: 'Skip Auto Propagation',
      dataIndex: 'skipAutoPropagation',
      key: 'skipAutoPropagation',
      render: (_: boolean, record: Namespace) =>
        getSkipAutoPropagationTag(record.skipAutoPropagation),
    },
    {
      title: 'Labels',
      dataIndex: 'labels',
      key: 'labels',
      render: (_: unknown, record: Namespace) => formatLabels(record),
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      render: (_: string, record: Namespace) => {
        const create = dayjs(record.objectMeta.creationTimestamp);
        return create.fromNow();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Namespace) => (
        <Space>
          <Button
            icon={<Icons.eye width={16} height={16} />}
            title="View namespace details"
            onClick={async () => {
              setViewLoading(true);
              try {
                const detail = await GetMemberClusterNamespaceDetail({
                  memberClusterName,
                  name: record.objectMeta.name,
                });
                setViewDetail(detail.data as Namespace);
                setViewDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load namespace');
              } finally {
                setViewLoading(false);
              }
            }}
          >
            View
          </Button>
          <Button
            icon={<Icons.edit width={16} height={16} />}
            title="Edit namespace (YAML)"
            onClick={async () => {
              try {
                const ret = await GetResource({
                  memberClusterName,
                  kind: record.typeMeta.kind,
                  name: record.objectMeta.name,
                  namespace: '',
                });
                if (ret.status !== 200) {
                  void messageApi.error('Failed to load namespace');
                  return;
                }
                setEditContent(stringify(ret.data));
                setEditDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load namespace');
              }
            }}
          >
            Edit
          </Button>
          <Button
            icon={<Icons.delete width={16} height={16} />}
            danger
            title="Delete namespace"
            disabled
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="h-full w-full flex flex-col p-4">
      <div className="flex flex-row space-x-4 mb-4">
        <Input.Search
          placeholder="Search by name"
          className="w-[300px]"
          onPressEnter={(e) => {
            const input = e.currentTarget.value;
            setFilter({
              ...filter,
              searchText: input,
            });
          }}
        />
      </div>

      <div className="flex-1 flex flex-col">
        <Table
          columns={columns}
          dataSource={data?.namespaces || []}
          rowKey={(record) => record.objectMeta.name}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} namespaces`,
          }}
          loading={isLoading}
        />
      </div>

      <Drawer
        title="Namespace details"
        placement="right"
        width={800}
        open={viewDrawerOpen}
        onClose={() => {
          setViewDrawerOpen(false);
          setViewDetail(null);
        }}
        destroyOnClose
      >
        {viewLoading && <div>Loading...</div>}
        {!viewLoading && viewDetail && (
          <div className="space-y-4">
            <div>
              <div className="font-semibold mb-2">Basic Info</div>
              <div>Name: {viewDetail.objectMeta?.name}</div>
              <div>
                Created:{' '}
                {viewDetail.objectMeta?.creationTimestamp
                  ? dayjs(viewDetail.objectMeta.creationTimestamp).format(
                    'YYYY-MM-DD HH:mm:ss',
                  )
                  : '-'}
              </div>
              <div>Status: {getStatusTag(viewDetail.phase)}</div>
              <div>
                Skip Auto Propagation:{' '}
                {getSkipAutoPropagationTag(viewDetail.skipAutoPropagation)}
              </div>
              <div>Labels: {formatLabels(viewDetail)}</div>
            </div>
          </div>
        )}
      </Drawer
      >

      <Drawer
        title="Edit Namespace (YAML)"
        placement="right"
        width={900}
        open={editDrawerOpen}
        onClose={() => {
          if (!editSubmitting) {
            setEditDrawerOpen(false);
            setEditContent('');
          }
        }}
        destroyOnClose
        extra={
          <Space>
            <Button
              type="primary"
              loading={editSubmitting}
              onClick={async () => {
                setEditSubmitting(true);
                try {
                  const yamlObject = parse(editContent) as Record<string, any>;
                  const kind = (yamlObject.kind || '') as string;
                  const metadata = (yamlObject.metadata || {}) as {
                    name?: string;
                  };
                  const name = metadata.name || '';

                  const ret = await PutResource({
                    memberClusterName,
                    kind,
                    name,
                    namespace: '',
                    content: yamlObject,
                  });

                  if (ret.code !== 200) {
                    void messageApi.error(
                      ret.message || 'Failed to update namespace',
                    );
                    return;
                  }

                  setEditDrawerOpen(false);
                  setEditContent('');
                } catch {
                  void messageApi.error('Failed to update namespace');
                } finally {
                  setEditSubmitting(false);
                }
              }}
            >
              Save
            </Button>
          </Space>
        }
      >
        <Editor
          height="600px"
          defaultLanguage="yaml"
          value={editContent}
          theme="vs"
          options={{
            theme: 'vs',
            lineNumbers: 'on',
            fontSize: 14,
            minimap: { enabled: false },
            wordWrap: 'on',
          }}
          onChange={(value) => setEditContent(value || '')}
        />
      </Drawer>
    </div>
  );
}
