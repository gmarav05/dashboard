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

import { App, Button, Drawer, Input, Select, Space, Table, TableColumnProps, Tag, Tooltip } from 'antd';
import { Icons } from '@/components/icons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMemberClusterContext, useMemberClusterNamespace } from '@/hooks';
import { ServiceAccount, GetMemberClusterServiceAccount, LocalObjectReference } from '@/services/member-cluster/serviceaccount';
import dayjs from 'dayjs';
import { stringify, parse } from 'yaml';
import Editor from '@monaco-editor/react';
import { GetResource, PutResource } from '@/services/member-cluster/unstructured';

export default function MemberClusterServiceAccounts() {
  const { message: messageApi } = App.useApp();
  const { memberClusterName } = useMemberClusterContext();

  const [filter, setFilter] = useState<{
    namespace: string;
    searchText: string;
  }>({
    namespace: '',
    searchText: '',
  });

  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<ServiceAccount | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const { nsOptions, isNsDataLoading } = useMemberClusterNamespace({ memberClusterName });

  const { data, isLoading } = useQuery({
    queryKey: ['GetMemberClusterServiceAccounts', memberClusterName, filter],
    queryFn: async () => {
      const ret = await GetMemberClusterServiceAccount({
        memberClusterName,
        namespace: filter.namespace || undefined,
        keyword: filter.searchText,
      });
      return ret;
    },
  });

  const getAutomountTag = (automount: boolean | undefined) => {
    if (automount === undefined) {
      return <Tag color="default">Unknown</Tag>;
    }
    return automount ? (
      <Tag color="green" icon={<Icons.key width={16} height={16} />}>
        Enabled
      </Tag>
    ) : (
      <Tag color="orange">Disabled</Tag>
    );
  };

  const formatSecrets = (secrets?: LocalObjectReference[]) => {
    if (!secrets || secrets.length === 0) {
      return <span className="text-gray-400">None</span>;
    }
    if (secrets.length === 1) {
      return <code className="text-xs">{secrets[0].name}</code>;
    }
    const names = secrets.map((s) => s.name);
    return (
      <Tooltip title={names.join(', ')}>
        <div className="flex items-center gap-1">
          <code className="text-xs">{names[0]}</code>
          <Tag color="blue">+{names.length - 1}</Tag>
        </div>
      </Tooltip>
    );
  };

  const formatImagePullSecrets = (secrets?: LocalObjectReference[]) => {
    if (!secrets || secrets.length === 0) {
      return <span className="text-gray-400">None</span>;
    }
    const names = secrets.map((s) => s.name);
    if (names.length === 1) {
      return (
          <Tag color="purple" icon={<Icons.certificate width={16} height={16} />}>
          {names[0]}
        </Tag>
      );
    }
    return (
      <Tooltip title={names.join(', ')}>
        <div className="flex items-center gap-1">
        <Tag color="purple" icon={<Icons.certificate width={16} height={16} />}>
            {names[0]}
          </Tag>
          <Tag color="cyan">+{names.length - 1}</Tag>
        </div>
      </Tooltip>
    );
  };

  const formatLabels = (sa: ServiceAccount) => {
    const labels = sa.objectMeta.labels || {};
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

  const columns: TableColumnProps<ServiceAccount>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: ServiceAccount) => (
        <div className="flex items-center gap-2">
          <Icons.certificate className="text-blue-500" width={16} height={16} />
          <strong>{record.objectMeta.name}</strong>
        </div>
      ),
    },
    {
      title: 'Namespace',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (_: string, record: ServiceAccount) => record.objectMeta.namespace,
    },
    {
      title: 'Automount Token',
      dataIndex: 'automountToken',
      key: 'automountToken',
      render: (_: boolean, record: ServiceAccount) =>
        getAutomountTag(record.automountServiceAccountToken),
    },
    {
      title: 'Secrets',
      key: 'secret',
      render: (_: unknown, record: ServiceAccount) =>
        formatSecrets(record.secrets),
    },
    {
      title: 'Image Pull Secrets',
      key: 'imagePullSecrets',
      render: (_: unknown, record: ServiceAccount) =>
        formatImagePullSecrets(record.imagePullSecrets),
    },
    {
      title: 'Labels',
      dataIndex: 'labels',
      key: 'labels',
      render: (_: unknown, record: ServiceAccount) => formatLabels(record),
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      render: (_: string, record: ServiceAccount) => {
        const create = dayjs(record.objectMeta.creationTimestamp);
        return create.fromNow();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: ServiceAccount) => (
        <Space>
          <Button
            icon={<Icons.eye width={16} height={16} />}
            title="View ServiceAccount Secret details"
            onClick={() => {
              setViewLoading(true);
              try {
                setViewDetail(record);
                setViewDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load Secret');
              } finally {
                setViewLoading(false);
              }
            }}
          >
            View
          </Button>
          <Button
            icon={<Icons.edit width={16} height={16} />}
            title="Edit ServiceAccount Secret (YAML)"
            onClick={async () => {
              try {
                const ret = await GetResource({
                  memberClusterName,
                  kind: record.typeMeta.kind,
                  name: record.objectMeta.name,
                  namespace: record.objectMeta.namespace,
                });
                if (ret.status !== 200) {
                  void messageApi.error('Failed to load Secret');
                  return;
                }
                setEditContent(stringify(ret.data));
                setEditDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load Secret');
              }
            }}
          >
            Edit
          </Button>
          <Button
            icon={<Icons.delete width={16} height={16} />}
            danger
            title="Delete ServiceAccount Secret"
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
        <h3 className="leading-[32px]">Namespace:</h3>
        <Select
          options={nsOptions}
          className="min-w-[200px]"
          value={filter.namespace}
          loading={isNsDataLoading}
          showSearch
          allowClear
          onChange={(v) => {
            setFilter({
              ...filter,
              namespace: v,
            });
          }}
        />
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
          dataSource={data?.items || []}
          rowKey={(record) =>
            `${record.objectMeta.namespace}-${record.objectMeta.name}`
          }
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} service accounts`,
          }}
          loading={isLoading}
        />
      </div>

      <Drawer
        title="ServiceAccount details"
        placement="right"
        size={800}
        open={viewDrawerOpen}
        onClose={() => {
          setViewDrawerOpen(false);
          setViewDetail(null);
        }}
        destroyOnHidden
      >
        {viewLoading && <div>Loading...</div>}
        {!viewLoading && viewDetail && (
          <div className="space-y-4">
            <div>
              <div className="font-semibold mb-2">Basic Info</div>
              <div>Name: {viewDetail.objectMeta?.name}</div>
              <div>Namespace: {viewDetail.objectMeta?.namespace}</div>
              <div>
                Created:{' '}
                {viewDetail.objectMeta?.creationTimestamp
                  ? dayjs(viewDetail.objectMeta.creationTimestamp).format(
                    'YYYY-MM-DD HH:mm:ss',
                  )
                  : '-'}
              </div>
              <div>Labels: {formatLabels(viewDetail)}</div>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        title="Edit ServiceAccount (YAML)"
        placement="right"
        size={900}
        open={editDrawerOpen}
        onClose={() => {
          if (!editSubmitting) {
            setEditDrawerOpen(false);
            setEditContent('');
          }
        }}
        destroyOnHidden
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
                    namespace?: string;
                  };
                  const name = metadata.name || '';
                  const namespace = metadata.namespace || '';

                  const ret = await PutResource({
                    memberClusterName,
                    kind,
                    name,
                    namespace,
                    content: yamlObject,
                  });

                  if (ret.code !== 200) {
                    void messageApi.error(
                      ret.message || 'Failed to update Secret',
                    );
                    return;
                  }

                  setEditDrawerOpen(false);
                  setEditContent('');
                } catch {
                  void messageApi.error('Failed to update Secret');
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
