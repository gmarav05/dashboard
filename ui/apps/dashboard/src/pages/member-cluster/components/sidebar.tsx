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

import { FC, Key, ReactNode } from 'react';
import type { MenuProps } from 'antd';
import { Menu } from 'antd';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Icons } from '@/components/icons'
import { cn } from '@/utils/cn';

interface MemberClusterSidebarProps {
  className?: string;
}

type MenuItem = Required<MenuProps>['items'][number];

const MemberClusterSidebar: FC<MemberClusterSidebarProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ memberCluster: string }>();
  const memberClusterName = params.memberCluster || '';

  // Get open keys based on current route - only open the group that contains the active item
  const getDefaultOpenKeys = () => {
    const pathname = location.pathname;
    if (pathname.includes('/workload/')) return ['workload-group'];
    if (pathname.includes('/service/')) return ['service-group'];
    if (pathname.includes('/config/')) return ['config-group'];
    if (pathname.includes('/cluster/')) return ['cluster-group'];
    return []; // No groups open by default
  };

  const getMenuItem = (
    label: ReactNode,
    key: Key,
    icon?: ReactNode,
    children?: MenuItem[],
  ): MenuItem => {
    return {
      key,
      icon,
      children,
      label,
      // type,
    } as MenuItem;
  };

  const menuItems: MenuItem[] = [
    getMenuItem('Overview', 'overview', <Icons.panelsTopLeft width={16} height={16} />),
    getMenuItem('Workload', 'workload-group', <Icons.deployment width={16} height={16} />, [
      getMenuItem('CronJobs', 'workload/cronjobs', <Icons.schedule width={16} height={16} />),
      getMenuItem('DaemonSets', 'workload/daemonsets', <Icons.control width={16} height={16} />),
      getMenuItem('Deployments', 'workload/deployments', <Icons.container width={16} height={16} />),
      getMenuItem('Jobs', 'workload/jobs', <Icons.control width={16} height={16} />),
    ]),

    getMenuItem('Service', 'service-group', <Icons.global width={16} height={16} />, [
      getMenuItem('Ingress', 'service/ingress', <Icons.cloudServer width={16} height={16} />),
      getMenuItem('Services', 'service/services', <Icons.api width={16} height={16} />),
    ]),

    getMenuItem('Config & Storage', 'config-group', <Icons.database width={16} height={16} />, [
      getMenuItem('ConfigMaps', 'config/configmaps', <Icons.page width={16} height={16} />),
      getMenuItem(
        'Persistent Volume Claims',
        'config/persistent-volume-claims',
        <Icons.database width={16} height={16} />,
      ),
      getMenuItem('Secrets', 'config/secrets', <Icons.lock width={16} height={16} />),
    ]),

    getMenuItem('Cluster', 'cluster-group', <Icons.clusters width={16} height={16} />, [
      getMenuItem(
        'Cluster Role Bindings',
        'cluster/cluster-role-bindings',
        <Icons.certificate width={16} height={16} />,
      ),
      getMenuItem(
        'Cluster Roles',
        'cluster/cluster-roles',
        <Icons.settings width={16} height={16} />,
      ),
      getMenuItem('Events', 'cluster/events', <Icons.audit width={16} height={16} />),
      getMenuItem('Namespaces', 'cluster/namespaces', <Icons.folder width={16} height={16} />),
      getMenuItem('Nodes', 'cluster/nodes', <Icons.node width={16} height={16} />),
      getMenuItem(
        'Persistent Volumes',
        'cluster/persistent-volumes',
        <Icons.database width={16} height={16} />,
      ),
      getMenuItem(
        'Role Bindings',
        'cluster/role-bindings',
        <Icons.certificate width={16} height={16} />,
      ),
      getMenuItem('Roles', 'cluster/roles', <Icons.settings width={16} height={16} />),
      getMenuItem(
        'Service Accounts',
        'cluster/service-accounts',
        <Icons.team width={16} height={16} />,
      ),
    ]),
  ];

  // Get current selected key from location
  const getSelectedKey = () => {
    const pathname = location.pathname;
    if (pathname.includes('overview')) return 'overview';

    // Extract the path after member cluster name
    const basePath = `/member-cluster/${memberClusterName}/`;
    if (pathname.startsWith(basePath)) {
      return pathname.slice(basePath.length);
    }

    return 'overview';
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    const basePath = `/member-cluster/${memberClusterName}`;
    navigate(`${basePath}/${key}`);
  };

  return (
    <div className={cn('w-full', 'h-full', 'overflow-y-auto')}>
      {/* Menu */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          defaultOpenKeys={getDefaultOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </div>
    </div>
  );
};

export default MemberClusterSidebar;
