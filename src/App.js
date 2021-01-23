import './App.css';
import {connect, Provider} from 'react-redux'
import createSagaMiddleware from 'redux-saga'
import {applyMiddleware, compose, createStore} from 'redux'
import {createBrowserHistory} from "history";
import {put, takeEvery} from "redux-saga/effects";
import * as R from 'ramda'

const lensPathWithDefault = (lensPath, theDefault) => {
    const theLens = R.lensPath(lensPath)
    const getter = R.pipe(R.view(theLens), R.defaultTo(theDefault))
    const setter = R.set(theLens)
    return R.lens(getter, setter)
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

const pageLens = lensPathWithDefault(['navigation', 'page'], '')

const fetchPage = (state, event) => R.set(pageLens, event.page, state)


const sagaMiddleware = createSagaMiddleware()
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const reducer = (state, event) => {
    switch (event.type) {
        case FETCH_PAGE_SUCCESS :
            return fetchPage(state, event)
        default:
            return state
    }
}

const store = createStore(
    reducer,
    {},
    composeEnhancers(applyMiddleware(sagaMiddleware))
)
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

const saga = function* () {
    yield takeEvery(FETCH_PAGE_REQUEST, handleFetchPageRequest)
    yield takeEvery(REDIRECT, handleRedirect)
}

sagaMiddleware.run(saga)
store.dispatch(fetchPageRequest())

const PageNotFound = ({page}) => <h1>{`Page '${page}' not found`}</h1>

const Profile = () => <div>Profile Component</div>
const Task = () => <div>Task Component</div>
const Summary = () => <div>Summary Component</div>

const Navigation = ({page}) => {
    const pageMap = {
        profile: Profile,
        task: Task
    }
    const Component = pageMap[page] || PageNotFound
    return <div className={'Navigation'}>
        <Component/>
        <Summary/>
    </div>
}

const mapNavigationStateToProps = state => ({
    page: R.view(pageLens, state)
})

const mapNavigationDispatchToProps = dispatch => ({})

const ConnectedNavigation = connect(mapNavigationStateToProps, mapNavigationDispatchToProps)(Navigation)

const App = () => <div className={'App'}>
    <Provider store={store}>
        <ConnectedNavigation/>
    </Provider>
</div>

export default App;
