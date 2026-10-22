@description('Globally unique Azure API hostname prefix.')
param appName string
param location string = resourceGroup().location
@allowed(['S1', 'P1v3'])
param sku string = 'S1'
param supabaseUrl string
@secure()
param supabaseAnonKey string
param redisUrl string
@secure()
param redisToken string
@secure()
param sessionSecret string

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${appName}-logs'
  location: location
  properties: {
    retentionInDays: 30
    sku: { name: 'PerGB2018' }
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
    IngestionMode: 'LogAnalytics'
    DisableLocalAuth: false
  }
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${appName}-plan'
  location: location
  kind: 'linux'
  sku: { name: sku, capacity: 1 }
  properties: { reserved: true }
}

var settings = [
  { name: 'ASPNETCORE_ENVIRONMENT', value: 'Production' }
  { name: 'SESSION_SECRET', value: sessionSecret }
  { name: 'UPSTASH_REDIS_REST_URL', value: redisUrl }
  { name: 'UPSTASH_REDIS_REST_TOKEN', value: redisToken }
  { name: 'SUPABASE_URL', value: supabaseUrl }
  { name: 'SUPABASE_ANON_KEY', value: supabaseAnonKey }
  { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
  { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
]

resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      appCommandLine: 'dotnet CareFiji.Api.dll'
      alwaysOn: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      healthCheckPath: '/health/ready'
      appSettings: settings
    }
  }
}

resource staging 'Microsoft.Web/sites/slots@2024-04-01' = {
  parent: app
  name: 'staging'
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      appCommandLine: 'dotnet CareFiji.Api.dll'
      alwaysOn: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      healthCheckPath: '/health/ready'
      appSettings: settings
    }
  }
}

output apiUrl string = 'https://${app.properties.defaultHostName}'
output stagingUrl string = 'https://${staging.properties.defaultHostName}'
