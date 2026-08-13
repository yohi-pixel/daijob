import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">explore_off</span>
      <h1 className="text-2xl font-bold text-on-surface">404</h1>
      <p className="text-sm text-on-surface-variant mt-2">页面不存在或已被移动</p>
      <Link
        to="/jobs"
        className="mt-6 punch-gradient text-on-primary font-semibold px-6 py-3 rounded-xl text-sm"
      >
        返回职位列表
      </Link>
    </div>
  );
}
