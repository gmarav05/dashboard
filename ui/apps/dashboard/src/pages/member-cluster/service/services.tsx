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
  Select,
  Space,
  Table,
  TableColumnProps,
  Tag,
  Tooltip,
} from 'antd';
import { Icons } from '@/components/icons';
import React from 'react';
import { useMemberClusterContext, useMemberClusterNamespace } from '@/hooks';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GetMemberClusterServiceDetail,
  GetMemberClusterServiceEvents,
  GetMemberClusterServices,
  Service,
  ServiceType,
} from '@/services/member-cluster/service';
import dayjs from 'dayjs';
import { stringify, parse } from 'yaml';
import Editor from '@monaco-editor/react';
import { GetResource, PutResource } from '@/services/member-cluster/unstructured';
import { Event } from '@/services/member-cluster/event'
export default function MemberClusterServices() {
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
  const [viewDetail, setViewDetail] = useState<Service | null>(null);
  const [viewEvents, setViewEvents] = useState<Event[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['GetServices', memberClusterName, filter],
    queryFn: async () => {
      const ret = await GetMemberClusterServices({
        memberClusterName,
        namespace: filter.selectedWorkSpace,
        keyword: filter.searchText,
      });
      return ret.data;
    },
  });

  const getTypeTag = (type: ServiceType) => {
    const typeColors: Record<ServiceType, string> = {
      [ServiceType.ClusterIP]: 'blue',
      [ServiceType.NodePort]: 'green',
      [ServiceType.LoadBalancer]: 'purple',
      [ServiceType.ExternalName]: 'orange',
    };

    const typeIcons: Record<string, React.ReactNode> = {
      'ClusterIP': <Icons.api width={16} height={16} />,
      'NodePort': <Icons.global width={16} height={16} />,
      'LoadBalancer': <Icons.global width={16} height={16} />,
      'ExternalName': <Icons.global width={16} height={16} />
    };

    return <Tag color={typeColors[type] || 'default'} icon={typeIcons[type]} className="inline-flex items-center gap-1.5">
      {type}
    </Tag>;
  };

  const getEndpointsTag = (endpointCount: number) => {
    const color = endpointCount > 0 ? 'success' : 'error';
    return <Tag color={color}>{endpointCount} ready</Tag>;
  };

  const formatExternalIPs = (svc: Service) => {
    const addresses = svc.externalEndpoints
      ?.flatMap((ep) => ep.host)
      .filter(Boolean);

    if (!addresses || addresses.length === 0) {
      return <span className="text-gray-400">None</span>;
    }

    if (addresses.length === 1) {
      return <code className="text-xs">{addresses[0]}</code>;
    }

    return (
      <Tooltip title={addresses.join(', ')}>
        <div className="flex items-center gap-1">
          <code className="text-xs">{addresses[0]}</code>
          <Tag color="blue">+{addresses.length - 1}</Tag>
        </div>
      </Tooltip>
    );
  };

  const formatSelector = (svc: Service) => {
    const selectorEntries = Object.entries(svc.selector || {});
    if (!selectorEntries.length) {
      return <span className="text-gray-400">-</span>;
    }
    const selectorText = selectorEntries
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');

    return (
      <Tooltip title={selectorText}>
        <Tag color="geekblue" className="text-xs">
          {selectorText.length > 30
            ? `${selectorText.substring(0, 30)}...`
            : selectorText}
        </Tag>
      </Tooltip>
    );
  };

  const formatPorts = (svc: Service) => {
    const ports = svc.internalEndpoint?.ports || [];
    if (!ports.length) {
      return <span className="text-gray-400">-</span>;
    }

    const portStrings = ports.map((p) => `${p.port}/${p.protocol}`);

    if (portStrings.length === 1) {
      return <code className="text-xs">{portStrings[0]}</code>;
    }

    return (
      <Tooltip title={portStrings.join(', ')}>
        <div className="flex items-center gap-1">
          <code className="text-xs">{portStrings[0]}</code>
          <Tag color="blue">+{portStrings.length - 1}</Tag>
        </div>
      </Tooltip>
    );
  };

  const columns: TableColumnProps<Service>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: Service) => (
        <strong>{record.objectMeta.name}</strong>
      ),
    },
    {
      title: 'Namespace',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (_: string, record: Service) => record.objectMeta.namespace,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (_: string, record: Service) => getTypeTag(record.type),
    },
    {
      title: 'Cluster IP',
      dataIndex: 'clusterIP',
      key: 'clusterIP',
      render: (_: string, record: Service) => (
        <code className="text-xs">{record.clusterIP}</code>
      ),
    },
    {
      title: 'External IP',
      dataIndex: 'externalIP',
      key: 'externalIP',
      render: (_: string, record: Service) => formatExternalIPs(record),
    },
    {
      title: 'Ports',
      dataIndex: 'ports',
      key: 'ports',
      render: (_: string, record: Service) => formatPorts(record),
    },
    {
      title: 'Endpoints',
      dataIndex: 'endpoints',
      key: 'endpoints',
      render: (_: number, record: Service) => {
        const endpointCount = record.internalEndpoint?.ports?.length || 0;
        return getEndpointsTag(endpointCount);
      },
    },
    {
      title: 'Selector',
      dataIndex: 'selector',
      key: 'selector',
      render: (_: string, record: Service) => formatSelector(record),
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      render: (_: string, record: Service) => {
        const create = dayjs(record.objectMeta.creationTimestamp);
        return create.fromNow();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Service) => (
        <Space>
          <Button
            icon={<Icons.eye width={16} height={16} />}
            title="View details"
            onClick={async () => {
              // Pre-fill basic info from list row so drawer always has content
              setViewDetail(record);
              setViewLoading(true);
              try {
                const detailResp = await GetMemberClusterServiceDetail({
                  memberClusterName,
                  namespace: record.objectMeta.namespace,
                  name: record.objectMeta.name,
                });
                const eventsResp = await GetMemberClusterServiceEvents({
                  memberClusterName,
                  namespace: record.objectMeta.namespace,
                  name: record.objectMeta.name,
                });

                setViewDetail((detailResp.data ?? {}) as Service);
                setViewEvents(eventsResp?.data?.events ?? []);
                setViewDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load Service details');
              } finally {
                setViewLoading(false);
              }
            }}
          >
            View
          </Button>
          <Button
            icon={<Icons.edit width={16} height={16} />}
            title="Edit Service"
            onClick={async () => {
              try {
                const ret = await GetResource({
                  memberClusterName,
                  kind: record.typeMeta.kind,
                  name: record.objectMeta.name,
                  namespace: record.objectMeta.namespace,
                });

                if (ret.status !== 200) {
                  void messageApi.error('Failed to load Service');
                  return;
                }

                setEditContent(stringify(ret.data));
                setEditDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load Service');
              }
            }}
          >
            Edit
          </Button>
          <Button
            icon={<Icons.delete width={16} height={16} />}
            danger
            title="Delete Service"
            disabled
          >
            Delete
          </Button>
        </Space>
      ),
    }
  ];

  return (
    <div className="h-full w-full flex flex-col p-4">
      <div className={"flex flex-row space-x-4 mb-4"}>
        <h3 className={"leading-[32px]"}>Namespace:</h3>
        <Select
          options={nsOptions}
          className={"min-w-[200px]"}
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
          placeholder="Search by name"
          className={"w-[300px]"}
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
          dataSource={data?.services || []}
          rowKey={(record) => record.objectMeta.name}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} services`,
          }}
          loading={isLoading}
        />
      </div>

      <Drawer
        title="Service details"
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
              <div>Type: {viewDetail.type}</div>
              <div>Cluster IP: {viewDetail.clusterIP}</div>
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
        title="Edit Service (YAML)"
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
                      ret.message || 'Failed to update Service',
                    );
                    return;
                  }

                  setEditDrawerOpen(false);
                  setEditContent('');
                } catch {
                  void messageApi.error('Failed to update Service');
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
