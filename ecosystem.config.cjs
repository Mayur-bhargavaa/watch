module.exports = {
  apps: [
    {
      name: 'watch-server',
      cwd: '/home/ubuntu/apps/watch/apps/server',
      script: 'dist/index.js',
      env_file: '.env'
    },
    {
      name: 'watch-web',
      cwd: '/home/ubuntu/apps/watch/apps/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3005',
      env: {
        NODE_ENV: 'production',
        PORT: 3005
      }
    }
  ]
};
