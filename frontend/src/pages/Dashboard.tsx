import { useState, useEffect } from 'react'
import { 
  Box, Typography, Grid, Paper, CircularProgress, 
  Card, CardContent, CardHeader, Divider 
} from '@mui/material'
import { 
  PeopleAlt as PeopleIcon, 
  LocalFireDepartment as FireIcon,
  DirectionsRun as EvacuationIcon,
  BarChart as StatsIcon
} from '@mui/icons-material'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import axios from 'axios'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface ModelMetrics {
  model_id: string
  model_type: string
  metrics: {
    avg_evacuation_time?: number
    avg_success_rate?: number
    avg_gini_coefficient?: number
    final_reward?: number
  }
}

interface ScenarioSummary {
  id: string
  name: string
  description: string
  type: string
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [models, setModels] = useState<ModelMetrics[]>([])
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const [error, setError] = useState('')
  
  useEffect(() => {
    // Fetch models and scenarios in parallel
    const fetchData = async () => {
      try {
        setLoading(true)
        
        const [modelsRes, scenariosRes] = await Promise.all([
          axios.get('/api/evaluate'),
          axios.get('/api/scenarios')
        ])
        
        setModels(modelsRes.data.models || [])
        setScenarios(scenariosRes.data.scenarios || [])
        setError('')
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError('Failed to load dashboard data. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])
  
  // Prepare chart data for evacuation times
  const evacuationTimeData = {
    labels: models.map(model => model.model_id.substring(0, 8) + '...'),
    datasets: [
      {
        label: 'Avg. Evacuation Time (s)',
        data: models.map(model => model.metrics.avg_evacuation_time || 0),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  }
  
  // Prepare chart data for success rates
  const successRateData = {
    labels: models.map(model => model.model_id.substring(0, 8) + '...'),
    datasets: [
      {
        label: 'Evacuation Success Rate',
        data: models.map(model => model.metrics.avg_success_rate || 0),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  }
  
  // Prepare chart data for fairness metrics
  const fairnessData = {
    labels: models.map(model => model.model_id.substring(0, 8) + '...'),
    datasets: [
      {
        label: 'Exit Allocation Fairness (1 - Gini)',
        data: models.map(model => 1 - (model.metrics.avg_gini_coefficient || 0)),
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
      },
    ],
  }
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <Typography color="error">{error}</Typography>
      </Box>
    )
  }
  
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        AI-Optimized Multi-Scale Evacuation Dashboard
      </Typography>
      
      {/* Summary Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={3} sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
            <PeopleIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
            <div>
              <Typography variant="body2" color="text.secondary">Models</Typography>
              <Typography variant="h5">{models.length}</Typography>
            </div>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={3} sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
            <FireIcon sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
            <div>
              <Typography variant="body2" color="text.secondary">Scenarios</Typography>
              <Typography variant="h5">{scenarios.length}</Typography>
            </div>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={3} sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
            <EvacuationIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
            <div>
              <Typography variant="body2" color="text.secondary">Avg. Success Rate</Typography>
              <Typography variant="h5">
                {models.length > 0
                  ? `${(models.reduce((sum, model) => sum + (model.metrics.avg_success_rate || 0), 0) / models.length * 100).toFixed(1)}%`
                  : 'N/A'
                }
              </Typography>
            </div>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={3} sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
            <StatsIcon sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
            <div>
              <Typography variant="body2" color="text.secondary">Exit Fairness</Typography>
              <Typography variant="h5">
                {models.length > 0
                  ? `${(models.reduce((sum, model) => sum + (1 - (model.metrics.avg_gini_coefficient || 0)), 0) / models.length * 100).toFixed(1)}%`
                  : 'N/A'
                }
              </Typography>
            </div>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Evacuation Times" />
            <Divider />
            <CardContent>
              <Box height={300}>
                {models.length > 0 ? (
                  <Line options={chartOptions} data={evacuationTimeData} />
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <Typography color="text.secondary">No model data available</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Evacuation Success Rates" />
            <Divider />
            <CardContent>
              <Box height={300}>
                {models.length > 0 ? (
                  <Line options={chartOptions} data={successRateData} />
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <Typography color="text.secondary">No model data available</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Exit Allocation Fairness" />
            <Divider />
            <CardContent>
              <Box height={300}>
                {models.length > 0 ? (
                  <Line options={chartOptions} data={fairnessData} />
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <Typography color="text.secondary">No model data available</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Available Scenarios" />
            <Divider />
            <CardContent>
              {scenarios.length > 0 ? (
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {scenarios.map((scenario) => (
                    <Paper key={scenario.id} sx={{ p: 2, mb: 2 }}>
                      <Typography variant="h6">{scenario.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{scenario.description}</Typography>
                      <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                        Type: {scenario.type}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                  <Typography color="text.secondary">No scenarios available</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
