import { Link } from 'react-router-dom';
import { Icon } from '../components/common/Icon';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <Icon name="explore_off" size={34} className="text-line" />
      <p className="mt-4 text-meta text-muted">404</p>
      <h1 className="mt-1 text-h2 font-medium text-ink">这个地址没有对应页面</h1>
      <p className="mt-2 text-body text-muted">可能是链接过期了，或者职位已经下架。</p>
      <Link
        to="/jobs"
        className="mt-6 rounded-md bg-primary px-4 py-2.5 text-body font-medium text-on-primary transition-colors hover:bg-secondary-dim"
      >
        回到职位列表
      </Link>
    </div>
  );
}
