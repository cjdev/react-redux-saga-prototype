import './App.css';
import {connect, Provider} from 'react-redux'
import createSagaMiddleware from 'redux-saga'
import {applyMiddleware, compose, createStore} from 'redux'
import {createBrowserHistory} from 'history';
import {all, put, takeEvery} from 'redux-saga/effects';
import * as R from 'ramda'

// environment
const history = createBrowserHistory()

// utility
const lensPathWithDefault = (lensPath, theDefault) => {
    const theLens = R.lensPath(lensPath)
    const getter = R.pipe(R.view(theLens), R.defaultTo(theDefault))
    const setter = R.set(theLens)
    return R.lens(getter, setter)
}

const pluralize = ({quantity, singular, plural}) => {
    if (quantity === 1) {
        return singular
    } else {
        return plural
    }
}

const fetchText = async (resource, init) => {
    try {
        const response = await fetch(resource, init)
        const text = await response.text()
        return text
    } catch (error) {
        const messageLines = []
        messageLines.push(`Unable to fetch resource '${resource}'`)
        if (init) {
            messageLines.push(`options = ${JSON.stringify(init)}`)
        }
        messageLines.push(`message = ${error.message}`)
        throw new Error(R.join('\n', messageLines))
    }
}

const fetchJson = async (resource, init) => {
    const text = await fetchText(resource, init)
    try {
        return JSON.parse(text)
    } catch (error) {
        const messageLines = []
        messageLines.push(`Unable to json from text '${text}'`)
        messageLines.push(`resource = ${resource}`)
        if (init) {
            messageLines.push(`options = ${JSON.stringify(init)}`)
        }
        messageLines.push(`message = ${error.message}`)
        throw new Error(R.join('\n', messageLines))
    }
}

// navigation - contract
const FETCH_PAGE_REQUEST = 'NAVIGATION/FETCH_PAGE_REQUEST'
const FETCH_PAGE_SUCCESS = 'NAVIGATION/FETCH_PAGE_SUCCESS'
const REDIRECT = 'NAVIGATION/REDIRECT'
const fetchPageRequest = () => ({type: FETCH_PAGE_REQUEST})
const fetchPageSuccess = page => ({type: FETCH_PAGE_SUCCESS, page})
const redirectRequest = uri => ({type: REDIRECT, uri})

// profile - contract
const profileUriPattern = /^\/profile($|\/)/
const ADD_PROFILE_REQUEST = 'PROFILE/ADD_PROFILE_REQUEST'
const FETCH_PROFILES_REQUEST = 'PROFILE/FETCH_PROFILES_REQUEST'
const FETCH_PROFILES_SUCCESS = 'PROFILE/FETCH_PROFILES_SUCCESS'
const PROFILE_NAME_CHANGED = 'PROFILE/PROFILE_NAME_CHANGED'
const DELETE_PROFILE_REQUEST = 'PROFILE/DELETE_PROFILE_REQUEST'
const fetchProfilesRequest = () => ({type: FETCH_PROFILES_REQUEST})
const addProfileRequest = name => ({type: ADD_PROFILE_REQUEST, name})
const fetchProfilesSuccess = profiles => ({type: FETCH_PROFILES_SUCCESS, profiles})
const profileNameChanged = name => ({type: PROFILE_NAME_CHANGED, name})
const deleteProfileRequest = id => ({type: DELETE_PROFILE_REQUEST, id})

// task - contract
const taskUriPattern = /^\/task\/([^/]*)/
const FETCH_TASKS_REQUEST = 'TASK/FETCH_TASKS_REQUEST'
const FETCH_TASKS_SUCCESS = 'TASK/FETCH_TASKS_SUCCESS'
const TASK_NAME_CHANGED = 'TASK/TASK_NAME_CHANGED'
const ADD_TASK_REQUEST = 'TASK/ADD_TASK_REQUEST'
const UPDATE_TASK_REQUEST = 'TASK/UPDATE_TASK_REQUEST'
const DELETE_TASKS_REQUEST = 'TASK/DELETE_TASKS_REQUEST'
const fetchTasksRequest = () => ({type: FETCH_TASKS_REQUEST})
const fetchTasksSuccess = ({profile, tasks}) => ({type: FETCH_TASKS_SUCCESS, profile, tasks})
const taskNameChanged = name => ({type: TASK_NAME_CHANGED, name})
const addTaskRequest = task => ({type: ADD_TASK_REQUEST, task})
const updateTaskRequest = task => ({type: UPDATE_TASK_REQUEST, task})
const deleteTasksRequest = taskIds => ({type: DELETE_TASKS_REQUEST, taskIds})

// summary - contract
const FETCH_SUMMARY_REQUEST = 'SUMMARY/FETCH_SUMMARY_REQUEST'
const FETCH_SUMMARY_SUCCESS = 'SUMMARY/FETCH_SUMMARY_SUCCESS'
const fetchSummaryRequest = () => ({type: FETCH_SUMMARY_REQUEST})
const fetchSummarySuccess = ({profileCount, taskCount}) => ({
    type: FETCH_SUMMARY_SUCCESS,
    profileCount,
    taskCount
})

// navigation - view
const PageNotFound = ({page}) => <h1>{`Page '${page}' not found`}</h1>
const Navigation = ({page}) => {
    const pageMap = {
        profile: ConnectedProfile,
        task: ConnectedTask
    }
    const Component = pageMap[page] || PageNotFound
    return <div className={'Navigation'}>
        <Component/>
        <ConnectedSummary/>
    </div>
}

// navigation - model
const lensPage = lensPathWithDefault(['navigation', 'page'], '')
const reduceFetchPageSuccess = (state, event) => R.set(lensPage, event.page, state)

// navigation - side effects
const handleFetchPageRequest = function* () {
    const uri = history.location.pathname
    if (profileUriPattern.test(uri)) {
        yield put(fetchPageSuccess('profile'))
        yield put(fetchProfilesRequest())
        yield put(fetchSummaryRequest())
    } else if (taskUriPattern.test(uri)) {
        yield put(fetchPageSuccess('task'))
        yield put(fetchTasksRequest())
        yield put(fetchSummaryRequest())
    } else {
        yield put(redirectRequest('/profile'))
    }
}
const handleRedirect = function* (event) {
    const uri = event.uri
    history.push(uri)
    history.go(0)
}

// navigation - connected
const mapNavigationStateToProps = state => ({
    page: R.view(lensPage, state)
})
const mapNavigationDispatchToProps = {}
const ConnectedNavigation = connect(mapNavigationStateToProps, mapNavigationDispatchToProps)(Navigation)

// profile - view
const ProfileListItem = ({profile, deleteProfileRequest}) => {
    const onClick = () => {
        deleteProfileRequest(profile.id)
    }
    return <>
        <label htmlFor={profile.id}><a href={'/task/' + profile.id}>{profile.name}</a></label>
        <button onClick={onClick} id={profile.id}>delete</button>
    </>
}
const ProfileList = ({profiles, deleteProfileRequest}) => {
    const createElement = profile =>
        <ProfileListItem key={profile.id}
                         profile={profile}
                         deleteProfileRequest={deleteProfileRequest}/>
    const profileElements = R.map(createElement, profiles)
    return <div className={'elements'}>
        {profileElements}
    </div>
}
const AddProfile = ({profileName, profileNameChanged, addProfileRequest}) => {
    const onKeyUp = event => {
        if (R.trim(profileName) === '') return
        if (event.key === 'Enter') addProfileRequest(profileName)
    }
    const onChange = event => {
        profileNameChanged(event.target.value)
    }
    return <input value={profileName}
                  autoFocus={true}
                  placeholder={'profile name'}
                  onKeyUp={onKeyUp}
                  onChange={onChange}/>
}
const Profile = ({profiles, profileName, profileNameChanged, addProfileRequest, deleteProfileRequest}) => {
    console.log({profiles, profileName, profileNameChanged, addProfileRequest, deleteProfileRequest})
    const header = `${profiles.length} ${pluralize({
        quantity: profiles.length,
        singular: 'profile',
        plural: 'profiles'
    })}`
    return <div className={'Profile'}>
        <h2>{header}</h2>
        <AddProfile profileName={profileName}
                    profileNameChanged={profileNameChanged}
                    addProfileRequest={addProfileRequest}/>
        <ProfileList profiles={profiles}
                     deleteProfileRequest={deleteProfileRequest}/>
    </div>
}

// profile - model
const lensProfiles = lensPathWithDefault(['profile', 'profiles'], [])
const lensProfileName = lensPathWithDefault(['profile', 'profileName'], '')
const reduceFetchProfilesSuccess = (state, event) => R.set(lensProfiles, event.profiles, state)
const reduceProfileNameChanged = (state, event) => R.set(lensProfileName, event.name, state)

// profile - side effects
const handleFetchProfilesRequest = function* () {
    const profiles = yield fetchJson('/proxy/profile')
    yield put(fetchProfilesSuccess(profiles))
}
const handleAddProfileRequest = function* (event) {
    const body = JSON.stringify({name: event.name})
    yield fetchText(`/proxy/profile`, {method: 'POST', body})
    yield put(profileNameChanged(''))
    yield put(fetchProfilesRequest())
    yield put(fetchSummaryRequest())
}
const handleDeleteProfileRequest = function* (event) {
    const profileId = event.id
    const allTasks = yield fetchJson('/proxy/task')
    const matchesProfile = task => task.profileId === profileId
    const tasksForProfile = R.filter(matchesProfile, allTasks)
    const taskIds = R.map(R.prop('id'), tasksForProfile)
    const createDeleteTaskFunction = taskId => fetchText(`/proxy/task/${taskId}`, {method: 'DELETE'})
    const deleteTaskFunctions = R.map(createDeleteTaskFunction, taskIds)
    yield all(deleteTaskFunctions)
    yield fetchText(`/proxy/profile/${profileId}`, {method: 'DELETE'})
    yield put(fetchProfilesRequest())
    yield put(fetchSummaryRequest())
}

// profile - connected
const mapProfileStateToProps = state => ({
    profiles: R.view(lensProfiles, state),
    profileName: R.view(lensProfileName, state)
})
const mapProfileDispatchToProps = {
    fetchProfilesRequest,
    addProfileRequest,
    fetchProfilesSuccess,
    profileNameChanged,
    deleteProfileRequest
}
const ConnectedProfile = connect(mapProfileStateToProps, mapProfileDispatchToProps)(Profile)

// task - view
const TaskListItem = ({task, updateTaskRequest}) => {
    const completeClass = task.complete ? 'complete' : 'in-progress';
    const onClick = () => {
        const newTask = {...task, complete: !task.complete}
        updateTaskRequest(newTask)
    }
    return <span className={completeClass} onClick={onClick}>
        {task.name}
    </span>
}
const TaskList = ({tasks, updateTaskRequest}) => {
    const createElement = task =>
        <TaskListItem key={task.id}
                      task={task}
                      updateTaskRequest={updateTaskRequest}/>
    const taskElements = R.map(createElement, tasks)
    return <div className={'elements'}>
        {taskElements}
    </div>
}
const AddTask = ({profile, taskName, taskNameChanged, addTaskRequest}) => {
    const onKeyUp = event => {
        if (R.trim(taskName) === '') return
        if (event.key !== 'Enter') return
        const task = {profileId: profile.id, name: taskName, complete: false}
        addTaskRequest(task)
    }
    const onChange = event => {
        taskNameChanged(event.target.value)
    }
    return <input value={taskName}
                  autoFocus={true}
                  placeholder={'task name'}
                  onKeyUp={onKeyUp}
                  onChange={onChange}/>
}
const Task = ({
                  profile,
                  tasks,
                  taskName,
                  taskNameChanged,
                  addTaskRequest,
                  updateTaskRequest,
                  deleteTasksRequest
              }) => {
    const header = `${tasks.length} ${pluralize({
        quantity: tasks.length,
        singular: 'task',
        plural: 'tasks'
    })} in profile ${profile.name}`
    const onClickClearComplete = () => {
        const taskIsComplete = task => task.complete
        const completedTasks = R.filter(taskIsComplete, tasks)
        const completedTaskIds = R.map(R.prop('id'), completedTasks)
        deleteTasksRequest(completedTaskIds)
    }
    return <div className={'Task'}>
        <h2>{header}</h2>
        <AddTask profile={profile}
                 taskName={taskName}
                 taskNameChanged={taskNameChanged}
                 addTaskRequest={addTaskRequest}/>
        <TaskList tasks={tasks}
                  updateTaskRequest={updateTaskRequest}/>
        <button onClick={onClickClearComplete}>Clear Completed</button>
        <a href={'/profile'}>Profiles</a>
    </div>
}

// task - model
const lensTaskProfile = lensPathWithDefault(['task', 'profile'], {id: 'null-profile-id', name: 'null-profile-name'})
const lensTasks = lensPathWithDefault(['task', 'tasks'], [])
const lensTaskName = lensPathWithDefault(['task', 'taskName'], '')
const reduceFetchTasksSuccess = (state, event) => R.pipe(
    R.set(lensTaskProfile, event.profile),
    R.set(lensTasks, event.tasks)
)(state)
const reduceTaskNameChanged = (state, event) => {
    const result = R.set(lensTaskName, event.name, state)
    return result
}

// task - side effects
const handleFetchTasksRequest = function* (event) {
    const uri = history.location.pathname
    const matchResult = uri.match(taskUriPattern)
    const profileId = matchResult[1]
    const profile = yield fetchJson(`/proxy/profile/${profileId}`)
    const allTasks = yield fetchJson('/proxy/task')
    const matchingProfileId = task => task.profileId === profileId
    const tasks = R.filter(matchingProfileId, allTasks)
    yield put(fetchTasksSuccess({profile, tasks}))
}
const handleAddTaskRequest = function* (event) {
    const task = event.task
    const body = JSON.stringify(task)
    yield fetchText(`/proxy/task`, {method: 'POST', body})
    yield put(taskNameChanged(''))
    yield put(fetchTasksRequest())
    yield put(fetchSummaryRequest())
}
const handleUpdateTaskRequest = function* (event) {
    const task = event.task
    const body = JSON.stringify(task)
    yield fetchText(`/proxy/task/${task.id}`, {method: 'POST', body})
    yield put(fetchTasksRequest())
}
const handleDeleteTasksRequest = function* (event) {
    const taskIds = event.taskIds
    const createDeleteTaskFunction = taskId => fetchText(`/proxy/task/${taskId}`, {method: 'DELETE'})
    const deleteTaskFunctions = R.map(createDeleteTaskFunction, taskIds)
    yield all(deleteTaskFunctions)
    yield put(fetchTasksRequest())
    yield put(fetchSummaryRequest())
}

// task - connected
const mapTaskStateToProps = state => ({
    profile: R.view(lensTaskProfile, state),
    tasks: R.view(lensTasks, state),
    taskName: R.view(lensTaskName, state)
})
const mapTaskDispatchToProps = {
    taskNameChanged,
    addTaskRequest,
    updateTaskRequest,
    deleteTasksRequest
}
const ConnectedTask = connect(mapTaskStateToProps, mapTaskDispatchToProps)(Task)

// summary - view
const Summary = ({profileCount, taskCount}) =>
    <div className={'Summary'}>
        <span>Number of profiles = {profileCount}</span>
        <span>Number of tasks across all profiles = {taskCount}</span>
    </div>

// summary - model
const lensProfileCount = lensPathWithDefault(['summary', 'profileCount'], 0)
const lensTaskCount = lensPathWithDefault(['summary', 'taskCount'], 0)
const reduceFetchSummarySuccess = (state, event) => R.pipe(
    R.set(lensProfileCount, event.profileCount),
    R.set(lensTaskCount, event.taskCount))(state)

// summary - side effects
const handleFetchSummaryRequest = function* () {
    const profiles = yield fetchJson('/proxy/profile')
    const profileCount = profiles.length
    const tasks = yield fetchJson('/proxy/task')
    const taskCount = tasks.length
    yield put(fetchSummarySuccess({profileCount, taskCount}))
}

// summary - connected
const mapSummaryStateToProps = state => ({
    profileCount: R.view(lensProfileCount, state),
    taskCount: R.view(lensTaskCount, state)
})
const mapSummaryDispatchToProps = {}
const ConnectedSummary = connect(mapSummaryStateToProps, mapSummaryDispatchToProps)(Summary)

// top level
const reducer = (state, event) => {
    switch (event.type) {
        case FETCH_PAGE_SUCCESS :
            return reduceFetchPageSuccess(state, event)
        case FETCH_PROFILES_SUCCESS:
            return reduceFetchProfilesSuccess(state, event)
        case PROFILE_NAME_CHANGED:
            return reduceProfileNameChanged(state, event)
        case FETCH_TASKS_SUCCESS:
            return reduceFetchTasksSuccess(state, event)
        case TASK_NAME_CHANGED:
            return reduceTaskNameChanged(state, event)
        case FETCH_SUMMARY_SUCCESS:
            return reduceFetchSummarySuccess(state, event)
        default:
            return state
    }
}

const saga = function* () {
    yield takeEvery(FETCH_PAGE_REQUEST, handleFetchPageRequest)
    yield takeEvery(FETCH_PROFILES_REQUEST, handleFetchProfilesRequest)
    yield takeEvery(ADD_PROFILE_REQUEST, handleAddProfileRequest)
    yield takeEvery(DELETE_PROFILE_REQUEST, handleDeleteProfileRequest)
    yield takeEvery(FETCH_TASKS_REQUEST, handleFetchTasksRequest)
    yield takeEvery(ADD_TASK_REQUEST, handleAddTaskRequest)
    yield takeEvery(UPDATE_TASK_REQUEST, handleUpdateTaskRequest)
    yield takeEvery(DELETE_TASKS_REQUEST, handleDeleteTasksRequest)
    yield takeEvery(FETCH_SUMMARY_REQUEST, handleFetchSummaryRequest)
    yield takeEvery(REDIRECT, handleRedirect)
}

const sagaMiddleware = createSagaMiddleware()
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const store = createStore(
    reducer,
    {},
    composeEnhancers(applyMiddleware(sagaMiddleware))
)
sagaMiddleware.run(saga)
store.dispatch(fetchPageRequest())

const App = () => <div className={'App'}>
    <Provider store={store}>
        <ConnectedNavigation/>
    </Provider>
</div>

export default App;
