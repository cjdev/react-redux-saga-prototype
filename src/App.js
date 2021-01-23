import './App.css';
import {connect, Provider} from 'react-redux'
import createSagaMiddleware from 'redux-saga'
import {applyMiddleware, compose, createStore} from 'redux'
import {createBrowserHistory} from "history";
import {all, put, takeEvery} from "redux-saga/effects";
import * as R from 'ramda'

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

const FETCH_PAGE_REQUEST = 'NAVIGATION/FETCH_PAGE_REQUEST'
const FETCH_PAGE_SUCCESS = 'NAVIGATION/FETCH_PAGE_SUCCESS'
const REDIRECT = 'NAVIGATION/REDIRECT'
const ADD_PROFILE_REQUEST = 'PROFILE/ADD_PROFILE_REQUEST'
const FETCH_PROFILES_REQUEST = 'PROFILE/FETCH_PROFILES_REQUEST'
const FETCH_PROFILES_SUCCESS = 'PROFILE/FETCH_PROFILES_SUCCESS'
const PROFILE_NAME_CHANGED = 'PROFILE/PROFILE_NAME_CHANGED'
const DELETE_PROFILE_REQUEST = 'PROFILE/DELETE_PROFILE_REQUEST'
const FETCH_TASKS_REQUEST = 'TASK/FETCH_TASKS_REQUEST'
const FETCH_TASKS_SUCCESS = 'TASK/FETCH_TASKS_SUCCESS'
const TASK_NAME_CHANGED = 'TASK/TASK_NAME_CHANGED'
const ADD_TASK_REQUEST = 'TASK/ADD_TASK_REQUEST'
const UPDATE_TASK_REQUEST = 'TASK/UPDATE_TASK_REQUEST'
const DELETE_TASKS_REQUEST = 'TASK/DELETE_TASKS_REQUEST'
const FETCH_SUMMARY_REQUEST = 'SUMMARY/FETCH_SUMMARY_REQUEST'
const FETCH_SUMMARY_SUCCESS = 'SUMMARY/FETCH_SUMMARY_SUCCESS'

const fetchPageRequest = () => ({type: FETCH_PAGE_REQUEST})
const fetchPageSuccess = page => ({type: FETCH_PAGE_SUCCESS, page})
const redirectRequest = uri => ({type: REDIRECT, uri})
const fetchProfilesRequest = () => ({type: FETCH_PROFILES_REQUEST})
const addProfileRequest = name => ({type: ADD_PROFILE_REQUEST, name})
const fetchProfilesSuccess = profiles => ({type: FETCH_PROFILES_SUCCESS, profiles})
const profileNameChanged = name => ({type: PROFILE_NAME_CHANGED, name})
const deleteProfileRequest = id => ({type: DELETE_PROFILE_REQUEST, id})
const fetchTasksRequest = () => ({type: FETCH_TASKS_REQUEST})
const fetchTasksSuccess = ({profile, tasks}) => ({type: FETCH_TASKS_SUCCESS, profile, tasks})
const taskNameChanged = name => ({type: TASK_NAME_CHANGED, name})
const addTaskRequest = task => ({type: ADD_TASK_REQUEST, task})
const updateTaskRequest = task => ({type: UPDATE_TASK_REQUEST, task})
const deleteTasksRequest = taskIds => ({type: DELETE_TASKS_REQUEST, taskIds})
const fetchSummaryRequest = () => ({type: FETCH_SUMMARY_REQUEST})
const fetchSummarySuccess = ({profileCount, taskCount}) => ({
    type: FETCH_SUMMARY_SUCCESS,
    profileCount,
    taskCount
})

const lensPage = lensPathWithDefault(['navigation', 'page'], '')
const lensProfiles = lensPathWithDefault(['profile', 'profiles'], [])
const lensProfileName = lensPathWithDefault(['profile', 'profileName'], '')
const lensProfileCount = lensPathWithDefault(['summary', 'profileCount'], 0)
const lensTaskCount = lensPathWithDefault(['summary', 'taskCount'], 0)

const reduceFetchProfilesSuccess = (state, event) => R.set(lensProfiles, event.profiles, state)
const reduceProfileNameChanged = (state, event) => R.set(lensProfileName, event.name, state)
const reduceFetchPageSuccess = (state, event) => R.set(lensPage, event.page, state)
const reduceFetchSummarySuccess = (state, event) => R.pipe(
    R.set(lensProfileCount, event.profileCount),
    R.set(lensTaskCount, event.taskCount))(state)

const sagaMiddleware = createSagaMiddleware()
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const reducer = (state, event) => {
    switch (event.type) {
        case FETCH_PAGE_SUCCESS :
            return reduceFetchPageSuccess(state, event)
        case FETCH_SUMMARY_SUCCESS:
            return reduceFetchSummarySuccess(state, event)
        case FETCH_PROFILES_SUCCESS:
            return reduceFetchProfilesSuccess(state, event)
        case PROFILE_NAME_CHANGED:
            return reduceProfileNameChanged(state, event)
        default:
            return state
    }
}

const history = createBrowserHistory()

const handleRedirect = function* (event) {
    const uri = event.uri
    history.push(uri)
    history.go(0)
}

const profileUriPattern = /^\/profile($|\/)/
const taskUriPattern = /^\/task\/([^/]*)/

const handleFetchPageRequest = function* () {
    const uri = history.location.pathname
    if (profileUriPattern.test(uri)) {
        yield put(fetchPageSuccess("profile"))
        yield put(fetchProfilesRequest())
        yield put(fetchSummaryRequest())
    } else if (taskUriPattern.test(uri)) {
        yield put(fetchPageSuccess("task"))
        yield put(fetchTasksRequest())
        yield put(fetchSummaryRequest())
    } else {
        yield put(redirectRequest('/profile'))
    }
}

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

const handleFetchSummaryRequest = function* () {
    const profiles = yield fetchJson('/proxy/profile')
    const profileCount = profiles.length
    const tasks = yield fetchJson('/proxy/task')
    const taskCount = tasks.length
    yield put(fetchSummarySuccess({profileCount, taskCount}))
}

const saga = function* () {
    yield takeEvery(FETCH_PAGE_REQUEST, handleFetchPageRequest)
    yield takeEvery(FETCH_PROFILES_REQUEST, handleFetchProfilesRequest)
    yield takeEvery(ADD_PROFILE_REQUEST, handleAddProfileRequest)
    yield takeEvery(DELETE_PROFILE_REQUEST, handleDeleteProfileRequest)
    yield takeEvery(FETCH_SUMMARY_REQUEST, handleFetchSummaryRequest)
    yield takeEvery(REDIRECT, handleRedirect)
}

const PageNotFound = ({page}) => <h1>{`Page '${page}' not found`}</h1>

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

const mapProfileStateToProps = state => ({
    profiles: R.view(lensProfiles, state),
    profileName: R.view(lensProfileName, state)
})

const mapProfileDispatchToProps = {
    fetchProfilesRequest,
    addProfileRequest,
    fetchProfilesSuccess,
    profileNameChanged: name => ({type: PROFILE_NAME_CHANGED, name}),
    deleteProfileRequest
}

const ConnectedProfile = connect(mapProfileStateToProps, mapProfileDispatchToProps)(Profile)

const Task = () => <div>Task Component</div>

const Summary = ({profileCount, taskCount}) =>
    <div className={"Summary"}>
        <span>Number of profiles = {profileCount}</span>
        <span>Number of tasks across all profiles = {taskCount}</span>
    </div>

const mapSummaryStateToProps = state => ({
    profileCount: R.view(lensProfileCount, state),
    taskCount: R.view(lensTaskCount, state)
})

const mapSummaryDispatchToProps = dispatch => ({})

const ConnectedSummary = connect(mapSummaryStateToProps, mapSummaryDispatchToProps)(Summary)

const Navigation = ({page}) => {
    const pageMap = {
        profile: ConnectedProfile,
        task: Task
    }
    const Component = pageMap[page] || PageNotFound
    return <div className={'Navigation'}>
        <Component/>
        <ConnectedSummary/>
    </div>
}

const mapNavigationStateToProps = state => ({
    page: R.view(lensPage, state)
})

const mapNavigationDispatchToProps = dispatch => ({})

const ConnectedNavigation = connect(mapNavigationStateToProps, mapNavigationDispatchToProps)(Navigation)

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
