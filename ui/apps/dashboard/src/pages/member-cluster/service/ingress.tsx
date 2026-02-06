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
import { useMemberClusterContext, useMemberClusterNamespace } from '@/hooks';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  GetMemberClusterIngress,
  GetMemberClusterIngressDetail,
  GetMemberClusterIngressEvents,
  Ingress,
} from '@/services/member-cluster/service';
import { Event } from '@/services/member-cluster/event'
import i18nInstance from '@/utils/i18n';
import dayjs from 'dayjs';
import { stringify, parse } from 'yaml';
import Editor from '@monaco-editor/react';
import { GetResource, PutResource } from '@/services/member-cluster/unstructured';

export default function MemberClusterIngress() {
  const { message: messageApi } = App.useApp();
  const { memberClusterName } = useMemberClusterContext();
  const [filter, setFilter] = useState<{
    selectedWorkSpace: string;
    searchText: string;
  }>({
    selectedWorkSpace: '',
    searchText: '',
  });
  const { nsOptions, isNsDataLoading } = useMemberClusterNamespace({ memberClusterName });

  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<Ingress | null>(null);
  const [viewEvents, setViewEvents] = useState<Event[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['GetIngress', memberClusterName, filter],
    queryFn: async () => {
      const ret = await GetMemberClusterIngress({
        memberClusterName,
        namespace: filter.selectedWorkSpace,
        keyword: filter.searchText,
      });
      return ret.data || {};
    },
  });

  const getStatusTag = (address: string) => {
    return address ?
      <Tag color="green" icon={<Icons.link width={16} height={16} />}>Ready</Tag> :
      <Tag color="orange">Pending</Tag>;
  };

  const getTlsTag = (tls: boolean) => {
    return tls ?
      <Tag color="blue" icon={<Icons.lock width={16} height={16} />}>TLS</Tag> :
      <Tag color="default">HTTP</Tag>;
  };

  const formatHosts = (hosts: string[]) => {
    if (hosts.length === 1) {
      return <code className="text-xs">{hosts[0]}</code>;
    }

    const displayHost = hosts[0];
    const remainingCount = hosts.length - 1;

    return (
      <Tooltip title={hosts.join(', ')}>
        <div className="flex items-center gap-1">
          <code className="text-xs">{displayHost}</code>
          {remainingCount > 0 && (
            <Tag color="blue">+{remainingCount}</Tag>
          )}
        </div>
      </Tooltip>
    );
  };

  const formatAddress = (address: string) => {
    return address ? (
      <code className="text-xs">{address}</code>
    ) : (
      <span className="text-gray-400">Pending</span>
    );
  };

  const columns: TableColumnProps<Ingress>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: Ingress) => (
        <strong>{record.objectMeta.name}</strong>
      ),
    },
    {
      title: 'Namespace',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (_: string, record: Ingress) => record.objectMeta.namespace,
    },
    {
      title: 'Class',
      dataIndex: 'class',
      key: 'class',
      render: () => (
        <Tag color="geekblue">IngressClass</Tag>
      )
    },
    {
      title: 'Hosts',
      dataIndex: 'hosts',
      key: 'hosts',
      render: (_: unknown, record: Ingress) => {
        // selector is labels of backend service; we don't have hosts list in this type yet
        const host = record.objectMeta.name;
        return formatHosts([host]);
      },
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      render: (_: string, record: Ingress) =>
        formatAddress(record.objectMeta.annotations?.['ingressAddress'] || ''),
    },
    {
      title: 'Ports',
      dataIndex: 'ports',
      key: 'ports',
      render: () => <code className="text-xs">-</code>,
    },
    {
      title: 'TLS',
      dataIndex: 'tls',
      key: 'tls',
      render: (_: boolean, record: Ingress) =>
        getTlsTag(
          record.objectMeta.annotations?.['ingress.kubernetes.io/ssl-redirect'] ===
          'true',
        ),
    },
    {
      title: 'Rules',
      dataIndex: 'rules',
      key: 'rules',
      render: () => <Tag color="purple">-</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (_: string, record: Ingress) =>
        getStatusTag(
          record.objectMeta.annotations?.['ingressAddress'] || '',
        ),
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      render: (_: string, record: Ingress) => {
        const create = dayjs(record.objectMeta.creationTimestamp);
        return create.fromNow();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Ingress) => (
        <Space>
          <Button
            icon={<Icons.eye width={16} height={16} />}
            title="View details"
            onClick={async () => {
              setViewLoading(true);
              try {
                const detailResp = await GetMemberClusterIngressDetail({
                  memberClusterName,
                  namespace: record.objectMeta.namespace,
                  name: record.objectMeta.name,
                });
                const eventsResp = await GetMemberClusterIngressEvents({
                  memberClusterName,
                  namespace: record.objectMeta.namespace,
                  name: record.objectMeta.name,
                });

                setViewDetail(detailResp.data as Ingress);
                setViewEvents(eventsResp.data?.events || []);
                setViewDrawerOpen(true);
              } finally {
                setViewLoading(false);
              }
            }}
          >
            View
          </Button>
          <Button
            icon={<Icons.edit width={16} height={16} />}
            title="Edit Ingress"
            onClick={async () => {
              try {
                const ret = await GetResource({
                  memberClusterName,
                  kind: record.typeMeta.kind,
                  name: record.objectMeta.name,
                  namespace: record.objectMeta.namespace,
                });

                if (ret.status !== 200) {
                  void messageApi.error('Failed to load Ingress');
                  return;
                }

                setEditContent(stringify(ret.data));
                setEditDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load Ingress');
              }
            }}
          >
            Edit
          </Button>
        </Space>
      ),
    }
  ];

  return (
    <div className="h-full w-full flex flex-col p-4">
      <div className={'flex flex-row space-x-4 mb-4'}>
        <h3 className={'leading-[32px]'}>
          {i18nInstance.t('280c56077360c204e536eb770495bc5f', '命名空间')}：
        </h3>
        <Select
          options={nsOptions}
          className={'min-w-[200px]'}
          value={filter.selectedWorkSpace}
          loading={isNsDataLoading}
          showSearch
          allowClear
          onChange={(v) => {
            setFilter({
              ...filter,
              selectedWorkSpace: v,
            });
          }}
        />
        <Input.Search
          placeholder={i18nInstance.t(
            'cfaff3e369b9bd51504feb59bf0972a0',
            '按命名空间搜索',
          )}
          className={'w-[300px]'}
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
          rowKey={(record) => record.objectMeta.name}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} ingress resources`,
          }}
          loading={isLoading}
        />
      </div>

      <Drawer
        title="Ingress details"
        placement="right"
        width={800}
        open={viewDrawerOpen}
        onClose={() => {
          setViewDrawerOpen(false);
          setViewDetail(null);
          setViewEvents([]);
        }}
        destroyOnClose
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
            </div>
            <div>
              <div className="font-semibold mb-2">Selector</div>
              <div>
                {Object.entries(viewDetail.selector || {}).map(([k, v]) => (
                  <Tag key={k} color="geekblue" className="text-xs mr-1">
                    {k}={v}
                  </Tag>
                ))}
                {!viewDetail.selector && <span>-</span>}
              </div>
            </div>
            <div>
              <div className="font-semibold mb-2">Events</div>
              <div className="space-y-1 max-h-64 overflow-auto text-xs">
                {viewEvents.map((e) => (
                  <div key={e.objectMeta.uid} className="border-b pb-1">
                    <div>
                      [{e.type}] {e.reason}
                    </div>
                    <div>{e.message}</div>
                    <div className="text-gray-500">
                      {e.sourceComponent} · {e.lastSeen}
                    </div>
                  </div>
                ))}
                {!viewEvents.length && <div>No events</div>}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        title="Edit Ingress (YAML)"
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
                      ret.message || 'Failed to update Ingress',
                    );
                    return;
                  }

                  setEditDrawerOpen(false);
                  setEditContent('');
                } catch {
                  void messageApi.error('Failed to update Ingress');
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
