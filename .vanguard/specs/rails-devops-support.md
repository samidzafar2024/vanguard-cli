# Rails & DevOps Support - Specification

## Overview
Add comprehensive Ruby on Rails stack support and DevOps persona with multi-platform deployment capabilities.

## 1. Rails Stack Definition

### Core Rails Conventions
- **Convention over Configuration**: Prefer Rails defaults
- **DRY (Don't Repeat Yourself)**: Extract common patterns
- **RESTful Design**: Resource-oriented architecture
- **Fat Models, Skinny Controllers**: Business logic in models
- **Service Objects**: Complex business logic extraction
- **Concerns**: Shared behavior modules
- **Active Record Patterns**: Query interface, scopes, associations

### File Structure
```
app/
├── controllers/          # HTTP request handling
│   ├── concerns/         # Shared controller behavior
│   └── api/              # API namespace
├── models/               # Business logic & data
│   └── concerns/         # Shared model behavior
├── views/                # Templates (ERB, Haml)
├── services/             # Complex business logic
├── jobs/                 # Background jobs (Sidekiq)
├── mailers/              # Email handling
├── channels/             # ActionCable websockets
└── helpers/              # View helpers

config/
├── routes.rb             # RESTful routing
├── database.yml          # DB configuration
├── environments/         # Environment configs
└── initializers/         # App initialization

db/
├── migrate/              # Database migrations
├── seeds.rb              # Sample data
└── schema.rb             # Current schema

lib/
└── tasks/                # Rake tasks

spec/ or test/            # RSpec or Minitest
```

### Rails Patterns to Emphasize

#### 1. RESTful Controllers
```ruby
class ArticlesController < ApplicationController
  before_action :set_article, only: [:show, :edit, :update, :destroy]

  def index
    @articles = Article.published.page(params[:page])
  end

  def create
    @article = Article.new(article_params)

    if @article.save
      redirect_to @article, notice: 'Article created'
    else
      render :new, status: :unprocessable_entity
    end
  end

  private

  def article_params
    params.require(:article).permit(:title, :body, :published)
  end
end
```

#### 2. Service Objects
```ruby
class Articles::PublishService
  def initialize(article)
    @article = article
  end

  def call
    return false unless @article.draft?

    ActiveRecord::Base.transaction do
      @article.update!(published_at: Time.current, status: 'published')
      NotificationMailer.article_published(@article).deliver_later
      true
    end
  rescue ActiveRecord::RecordInvalid
    false
  end
end
```

#### 3. Active Record Patterns
```ruby
class Article < ApplicationRecord
  # Associations
  belongs_to :author, class_name: 'User'
  has_many :comments, dependent: :destroy

  # Validations
  validates :title, presence: true, length: { maximum: 200 }
  validates :body, presence: true

  # Scopes
  scope :published, -> { where.not(published_at: nil) }
  scope :recent, -> { order(created_at: :desc) }

  # Callbacks
  before_save :generate_slug
  after_commit :notify_subscribers, on: :create

  # Instance methods
  def draft?
    published_at.nil?
  end

  private

  def generate_slug
    self.slug = title.parameterize
  end
end
```

#### 4. Concerns
```ruby
module Publishable
  extend ActiveSupport::Concern

  included do
    scope :published, -> { where.not(published_at: nil) }
    scope :draft, -> { where(published_at: nil) }
  end

  def publish!
    update!(published_at: Time.current)
  end

  def draft?
    published_at.nil?
  end
end
```

### Rails Testing Patterns (RSpec)
```ruby
RSpec.describe Article, type: :model do
  describe 'validations' do
    it { should validate_presence_of(:title) }
    it { should validate_length_of(:title).is_at_most(200) }
  end

  describe 'associations' do
    it { should belong_to(:author) }
    it { should have_many(:comments) }
  end

  describe 'scopes' do
    describe '.published' do
      it 'returns only published articles' do
        published = create(:article, published_at: 1.day.ago)
        draft = create(:article, published_at: nil)

        expect(Article.published).to include(published)
        expect(Article.published).not_to include(draft)
      end
    end
  end

  describe '#publish!' do
    it 'sets published_at to current time' do
      article = create(:article, published_at: nil)

      Timecop.freeze do
        article.publish!
        expect(article.published_at).to eq(Time.current)
      end
    end
  end
end
```

### Modern Rails Features
- **Hotwire (Turbo + Stimulus)**: Modern JavaScript framework
- **ActionCable**: WebSocket support
- **Active Storage**: File uploads
- **Action Mailbox**: Incoming email handling
- **Action Text**: Rich text content
- **Credentials**: Encrypted secrets
- **Active Job**: Background processing
- **Import Maps**: JavaScript without bundler

## 2. Rails Architect Persona

### Expertise Areas
1. **Rails Architecture Patterns**
   - MVC and modern alternatives
   - Service Objects
   - Form Objects
   - Query Objects
   - Decorators/Presenters
   - Repository Pattern (when needed)

2. **Database Design**
   - PostgreSQL best practices
   - Active Record migrations
   - Database indexing strategies
   - N+1 query prevention
   - Database constraints

3. **Performance**
   - Query optimization
   - Caching strategies (Russian Doll, Fragment, Page)
   - Background jobs
   - Database connection pooling

4. **API Design**
   - RESTful APIs
   - JSON:API serialization
   - API versioning
   - Rate limiting
   - Authentication (JWT, session)

5. **Modern Rails**
   - Hotwire architecture
   - Import maps vs webpack
   - Turbo Frames and Streams
   - Stimulus controllers

## 3. DevOps Persona

### Core Competencies
1. **Container Orchestration**
   - Docker best practices
   - Multi-stage builds
   - Container optimization
   - Security scanning

2. **CI/CD Pipelines**
   - GitHub Actions
   - GitLab CI
   - Testing automation
   - Deployment automation

3. **Platform-Specific Deployment**
   - Vercel (Next.js, static sites)
   - Railway (full-stack apps, databases)
   - Azure ACA (containerized apps)
   - AWS ECS (production-grade containers)

4. **Infrastructure as Code**
   - Terraform basics
   - Platform configurations
   - Environment management

5. **Monitoring & Observability**
   - Logging strategies
   - Error tracking (Sentry, Rollbar)
   - Performance monitoring (New Relic, DataDog)
   - Uptime monitoring

6. **Security**
   - Secrets management
   - Environment variables
   - SSL/TLS configuration
   - Security headers

## 4. Deployment Targets

### Vercel
**Best For**: Next.js, React, static sites, serverless functions

**Skills Required**:
- `vercel.json` configuration
- Environment variables
- Build configuration
- Edge functions
- Serverless functions
- Domain configuration
- Preview deployments

**Example vercel.json**:
```json
{
  "buildCommand": "npm run build",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "DATABASE_URL": "@database-url"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

### Railway
**Best For**: Full-stack apps, databases, background workers

**Skills Required**:
- Railway.toml configuration
- Nixpacks or Dockerfile
- Service linking
- Database provisioning
- Environment variables
- TCP proxying
- Private networking

**Example Railway.toml**:
```toml
[build]
builder = "nixpacks"
buildCommand = "bundle install && rails assets:precompile"

[deploy]
startCommand = "bin/rails server -b 0.0.0.0"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[services]]
name = "web"
```

### Azure Container Apps (ACA)
**Best For**: Enterprise containerized apps, microservices, event-driven workloads

**Skills Required**:
- Azure CLI (`az containerapp`)
- Container registries (ACR)
- Managed environments
- Ingress configuration
- Dapr integration
- KEDA scaling
- Azure Identity

**Example Deployment**:
```bash
# Create resource group
az group create --name myapp-rg --location eastus

# Create container registry
az acr create --resource-group myapp-rg --name myappregistry --sku Basic

# Create container app environment
az containerapp env create \
  --name myapp-env \
  --resource-group myapp-rg \
  --location eastus

# Create container app
az containerapp create \
  --name myapp \
  --resource-group myapp-rg \
  --environment myapp-env \
  --image myappregistry.azurecr.io/myapp:latest \
  --target-port 3000 \
  --ingress 'external' \
  --min-replicas 1 \
  --max-replicas 10 \
  --env-vars DATABASE_URL=secretref:database-url
```

**Configuration File (containerapp.yaml)**:
```yaml
properties:
  managedEnvironmentId: /subscriptions/.../environments/myapp-env
  configuration:
    ingress:
      external: true
      targetPort: 3000
      transport: auto
    secrets:
      - name: database-url
        value: postgresql://...
    registries:
      - server: myappregistry.azurecr.io
        username: myappregistry
        passwordSecretRef: registry-password
  template:
    containers:
      - image: myappregistry.azurecr.io/myapp:latest
        name: myapp
        env:
          - name: DATABASE_URL
            secretRef: database-url
        resources:
          cpu: 0.5
          memory: 1Gi
    scale:
      minReplicas: 1
      maxReplicas: 10
      rules:
        - name: http-rule
          http:
            metadata:
              concurrentRequests: "100"
```

### AWS ECS (Elastic Container Service)
**Best For**: Production-grade container orchestration, enterprise workloads

**Skills Required**:
- ECS task definitions
- Fargate vs EC2 launch types
- ECR (Elastic Container Registry)
- Application Load Balancer
- Auto Scaling
- CloudWatch logs
- IAM roles and policies
- VPC networking

**Example Task Definition**:
```json
{
  "family": "myapp",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "myapp",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:db-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/myapp",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole"
}
```

**ECS Service Definition**:
```json
{
  "serviceName": "myapp-service",
  "taskDefinition": "myapp:1",
  "desiredCount": 2,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-abc123", "subnet-def456"],
      "securityGroups": ["sg-xyz789"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:...",
      "containerName": "myapp",
      "containerPort": 3000
    }
  ],
  "deploymentConfiguration": {
    "maximumPercent": 200,
    "minimumHealthyPercent": 100
  }
}
```

## 5. Rails-Specific Agent Updates

### Developer Agent - Rails Context
```markdown
## Rails Development Patterns

### Controller Actions
- Keep controllers thin - delegate to services or models
- Use strong parameters for security
- Return proper HTTP status codes
- Use `render` and `redirect_to` appropriately

### Model Development
- Use validations extensively
- Define associations clearly
- Use scopes for common queries
- Implement callbacks sparingly (prefer service objects)
- Use concerns for shared behavior

### Service Objects
- One responsibility per service
- Use `call` method convention
- Return success/failure explicitly
- Wrap in transactions when needed

### Testing
- Test models thoroughly (validations, associations, methods)
- Controller tests for request/response
- System tests for user workflows
- Use factories (FactoryBot) not fixtures
```

### Architect Agent - Rails Context
```markdown
## Rails Architecture Decisions

### When to Use Service Objects
- Complex business logic involving multiple models
- External API integrations
- Multi-step operations
- Operations that need transactions

### When to Use Concerns
- Shared behavior across multiple models
- Cross-cutting functionality
- Code that doesn't fit in a single class

### Performance Patterns
- Use `includes` to prevent N+1 queries
- Add database indexes for foreign keys and frequently queried columns
- Use counter caches for associations
- Implement fragment caching for expensive views
- Use background jobs for slow operations

### API Architecture
- Version your APIs (v1/, v2/)
- Use serializers (Active Model Serializers, jsonapi-serializer)
- Implement pagination
- Add rate limiting (rack-attack)
- Use proper HTTP status codes
```

## 6. Project Configuration Updates

### Add to `.vanguard/config.yaml`
```yaml
version: 1
project: myapp
type: brownfield
track: team
stack: rails
architecture: mvc
deployment:
  targets:
    - vercel
    - railway
    - azure-aca
    - aws-ecs
  primary: railway
  environments:
    - development
    - staging
    - production
```

## 7. Implementation Checklist

- [ ] Add `ruby` to Language type
- [ ] Create Rails stack definition in `src/presentation/data/stacks/index.ts`
- [ ] Create Rails Architect persona (`.vanguard/agents/rails-architect.md`)
- [ ] Create DevOps persona (`.vanguard/agents/devops.md`)
- [ ] Update all agent personas with Rails context sections
- [ ] Add deployment target selection to init command
- [ ] Create deployment skills:
  - [ ] Vercel deployment guide
  - [ ] Railway deployment guide
  - [ ] Azure ACA deployment guide
  - [ ] AWS ECS deployment guide
- [ ] Update Developer persona with Rails patterns
- [ ] Update Architect persona with Rails architecture
- [ ] Add Rails testing patterns to QA persona
- [ ] Create Rails migration guide for PM persona

## 8. Testing Strategy

### For Rails Stack
- Generate sample Rails project with `rails new`
- Run `vanguard init` and verify Rails stack appears
- Verify Rails-specific templates generate correctly
- Test agent responses include Rails patterns

### For DevOps
- Verify deployment target selection in init
- Test deployment configurations generate correctly
- Validate platform-specific files (vercel.json, Railway.toml, etc.)

## 9. Documentation Updates

### Add to docs site:
- Rails stack guide
- Rails architecture patterns
- DevOps workflow guide
- Deployment target comparison
- Platform-specific deployment guides
