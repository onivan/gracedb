let currentPage = 1;
let currentLimit = 5;
let lookupLists = {};
// Глобальна змінна для стану фільтра
let birthdayFilterActive = false;
const USER_ROLE = document.body.dataset.userRole || 'viewer';

// Початкова конфігурація колонок
let columnConfigOld = {
    id: { title: 'ID', visible: true },
    name: { title: "Ім'я", visible: true },
    Mobile_Phone: { title: 'Мобільний', visible: true },
    Home_phone: { title: 'Домашній', visible: false },
    Work_phone: { title: 'Робочий', visible: false },
    email: { title: 'Email', visible: true },
    address: { title: 'Адреса', visible: false },
    church_status: { title: 'Статус', visible: true },
    send_bd_sms: { title: 'SMS', visible: true },
    children: { title: 'Діти', visible: true },
    actions: { title: 'Дії', visible: true }
};

// Початкова конфігурація колонок
let columnConfig = {
    id: { title: 'ID', visible: true },
    name: { title: "Ім'я", visible: true },
    phones: { title: 'Телефони', visible: true }, // Об'єднана колонка
    Date_of_Birth: { title: 'Дн', visible: true },
    Date_of_Bapt: { title: 'Хрещення', visible: true },
    email: { title: 'Email', visible: false },
    address: { title: 'Адреса', visible: false },
    church_status: { title: 'Статус', visible: true },
    children: { title: 'Діти', visible: true },
    send_bd_sms: { title: 'SMS', visible: false },
    actions: { title: 'Дії', visible: true }
};


// Завантаження налаштувань з пам'яті браузера
function loadSettings() {
    const saved = localStorage.getItem('grace_columns');
    if (saved) {
        const parsed = JSON.parse(saved);
        for (let key in parsed) {
            if (columnConfig[key]) columnConfig[key].visible = parsed[key];
        }
    }
}

// Ініціалізація меню вибору колонок
function initColumnMenu() {
    const menu = document.getElementById('columnToggleMenu');
    menu.innerHTML = '';
    
    Object.keys(columnConfig).forEach(key => {
        if (key === 'actions') return; // Дії не ховаємо
        const checked = columnConfig[key].visible ? 'checked' : '';
        menu.innerHTML += `
            <div class="form-check mb-1">
                <input class="form-check-input" type="checkbox" id="col_${key}" ${checked} 
                       onchange="toggleColumn('${key}', this.checked)">
                <label class="form-check-label small" for="col_${key}">${columnConfig[key].title}</label>
            </div>
        `;
    });
}



// Функція для отримання текстового значення з довідників
function translateStatus(listName, id) {
    // Якщо список не завантажився або ID порожній
    if (!lookupLists || !lookupLists[listName] || id === null || id === undefined) {
        return id || '';
    }

    const list = lookupLists[listName];
    let value = list[id];

    // Якщо значення за цим ID — це об'єкт (наприклад, {id: 1, text: "Член"}), 
    // витягуємо текстове поле
    if (typeof value === 'object' && value !== null) {
        return value.text || value.name || value.title || JSON.stringify(value);
    }

    // Якщо в списку за цим ID нічого немає, повертаємо саме число ID
    return value !== undefined ? value : id;
}


// ОСНОВНА ФУНКЦІЯ ВИВОДУ ДАНИХ
// 1. Оновлена функція перемикання колонок
function toggleColumn(key, isVisible) {
    columnConfig[key].visible = isVisible;
    
    // Зберігаємо налаштування в браузері
    localStorage.setItem('grace_columns', JSON.stringify(
        Object.keys(columnConfig).reduce((acc, k) => ({...acc, [k]: columnConfig[k].visible}), {})
    ));

    // Якщо дані завантажені, просто перемальовуємо їх
    if (window.currentPeopleData) {
        renderPeople(window.currentPeopleData);
    } else {
        loadPeople();
    }
}

// 2. Функція рендерингу заголовків
function renderHeaders() {
    // Згідно з вашим index.html рядок має id="tableHeader"
    const theadRow = document.getElementById('tableHeader');
    if (!theadRow) return;

    theadRow.innerHTML = '';
    Object.keys(columnConfig).forEach(key => {
        if (columnConfig[key].visible) {
            const th = document.createElement('th');
            th.textContent = columnConfig[key].title;
            theadRow.appendChild(th);
        }
    });
}

// 3. ЄДИНА правильна функція рендерингу таблиці
function renderPeople(people) {
    // ВАЖЛИВО: Кешуємо дані, щоб toggleColumn міг їх перемалювати без запиту на сервер
    window.currentPeopleData = people; 

    const tbody = document.querySelector('#mainPeopleTable tbody');
    if (!tbody) return;

    // Оновлюємо заголовки перед малюванням рядків, щоб вони збігалися
    renderHeaders();

    tbody.innerHTML = '';
    people.forEach(person => {
        const tr = document.createElement('tr');
        
        // Повертаємо підсвітку рядка та завантаження фото по кліку
        tr.onclick = () => {
            document.querySelectorAll('tr').forEach(r => r.classList.remove('table-active-row'));
            tr.classList.add('table-active-row');
            if (typeof loadPhotos === 'function') loadPhotos(person.id, person.name);
        };

        Object.keys(columnConfig).forEach(key => {
            if (!columnConfig[key].visible) return;

            const td = document.createElement('td');
            td.setAttribute('data-label', columnConfig[key].title);

            if (key === 'phones') {
                const phoneFields = ['Mobile_Phone', 'Home_phone', 'Work_phone', 'Mobile_Phone_a'];
                const formatted = phoneFields
                    .map(f => person[f])
                    .filter(v => v && v !== 0 && v !== '0' && v !== '')
                    .map(v => formatPhoneNumber(v));
                td.innerHTML = formatted.join('<br>');
            } 
            else if (key === 'send_bd_sms') {
                td.style.textAlign = 'center';
                // Перевіряємо на 1, '1' або true
                td.textContent = (person[key] == 'Y' || person[key] == 1 || person[key] === true) ? '✅' : '❌';
            }
            else if (key === 'Date_of_Birth' || key === 'Date_of_Bapt') {
                const d = person[key];
                td.textContent = (d && !d.includes('1900')) ? d : '-';
            }
            else if (key === 'church_status') {
                const statusObj = lookupLists.church_status?.find(s => s.id == person[key]);
                td.textContent = statusObj ? statusObj.list_name : (person[key] || '');
            }
            else if (key === 'actions') {
                // Додано event для зупинки поширення кліку (щоб не відкривалося фото при кліку на кнопки)
                td.innerHTML = `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary" onclick="openModal(${person.id}, event)">✎</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deletePerson(${person.id}, event)">🗑</button>
                    </div>`;
            }
            else {
                td.textContent = person[key] || '';
            }
            
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
}

function renderPeople_old(people) {
    window.currentPeopleData = people; // Кешуємо для перемикання колонок
    const tbody = document.getElementById('peopleTableBody');
    tbody.innerHTML = '';

    people.forEach(person => {
        const tr = document.createElement('tr');
        // Додаємо клас для підсвічування обраного рядка
        tr.onclick = () => {
            document.querySelectorAll('tr').forEach(r => r.classList.remove('table-active-row'));
            tr.classList.add('table-active-row');
            if (typeof loadPhotos === 'function') loadPhotos(person.id, person.name);
        };

        let rowContent = '';
        
        if (columnConfig.id.visible) rowContent += `<td>${person.id}</td>`;
        if (columnConfig.name.visible) rowContent += `<td class="fw-bold">${person.name}</td>`;
        if (columnConfig.Mobile_Phone.visible) rowContent += `<td>${formatPhoneNumber(person.Mobile_Phone) || ''}</td>`;
        if (columnConfig.Home_phone.visible) rowContent += `<td>${formatPhoneNumber(person.Home_phone) || ''}</td>`;
        if (columnConfig.Work_phone.visible) rowContent += `<td>${formatPhoneNumber(person.Work_phone) || ''}</td>`;
        if (columnConfig.email.visible) rowContent += `<td>${person.email || ''}</td>`;
        if (columnConfig.address.visible) rowContent += `<td><small>${person.address || ''}</small></td>`;
        
        if (columnConfig.church_status.visible) {
			// Використовуємо наш новий помічник для перекладу
			//console.log(person.church_status + " ");
			const statusFind = (lookupLists.church_status || []).find(item => item.id === person.church_status);
			const statusText = statusFind ? statusFind.list_name : (person.church_status || '');
			
			// Визначаємо колір бейджа (опціонально, для краси)
			const badgeClass = person.church_status == 1 ? 'bg-success' : 'bg-light text-dark';
			
			rowContent += `<td><span class="badge ${badgeClass} border">${statusText}</span></td>`;
		}
        
        if (columnConfig.send_bd_sms.visible) {
            rowContent += `<td class="text-center">${person.send_bd_sms ? '✅' : '❌'}</td>`;
        }

        if (columnConfig.actions.visible) {
            rowContent += `
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" onclick="openModal(${person.id})">✎</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deletePerson(${person.id})">🗑</button>
                </td>
            `;
        }

        tr.innerHTML = rowContent;
        tbody.appendChild(tr);
    });
}

// Налаштування слухачів після завантаження сторінки
document.addEventListener('DOMContentLoaded', () => {
    // Для текстових полів (input)
    document.querySelectorAll('.filter-input').forEach(input => {
        input.addEventListener('input', processChange);
    });

    // Для списків (select) — спрацьовує миттєво при виборі
    document.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', () => applyFilters());
    });
    
    loadSavedFilters();
});


// Додаємо ініціалізацію в обробник завантаження
document.addEventListener('DOMContentLoaded', async () => {
    loadSettings();
    initColumnMenu();
    //renderHeaders();
    await fetchLists();
    renderFilterCheckboxes();
    loadSavedFilters();
    loadPeople();
    // Обробник зміни ліміту на сторінку
    document.getElementById('limitSelect').addEventListener('change', (e) => {
        currentLimit = e.target.value;
        currentPage = 1;
        renderFilterCheckboxes();
		loadSavedFilters();
        loadPeople();
    });
});

function toggleLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
}

// Також корисно додати універсальну функцію для запитів, якщо ви її ще не додали
async function apiRequest(url, options = {}) {
    toggleLoader(true);
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Помилка сервера');
        return data;
    } catch (error) {
        console.error('API Error:', error);
        alert('Сталася помилка: ' + error.message);
    } finally {
        toggleLoader(false);
    }
}


async function fetchLists() {
    try {
        const response = await fetch(SCRIPT_ROOT + '/api/lists');
        if (!response.ok) throw new Error('Помилка завантаження списків');
        
        lookupLists = await response.json();
        console.log("Завантажені довідники:", lookupLists); // Для діагностики в консолі (F12)

        // Додаємо перевірку: якщо ключ існує, заповнюємо
        if (lookupLists.gender) populateSelect('genderSelect', lookupLists.gender);
        if (lookupLists.fam_status) populateSelect('famStatusSelect', lookupLists.fam_status);
        if (lookupLists.church_status) populateSelect('churchStatusSelect', lookupLists.church_status);
        
    } catch (err) {
        console.error("Помилка у fetchLists:", err);
    }
}

function populateSelect(elementId, dataList) {
    const select = document.getElementById(elementId);
    if (!select) return; // Якщо елемента немає на сторінці
    
    select.innerHTML = '<option value="0">Не вибрано</option>';
    
    // КРИТИЧНО: Перевіряємо, чи dataList є масивом
    if (Array.isArray(dataList)) {
        dataList.forEach(item => {
            // Використовуйте ті назви ключів, які приходять з бази (id та list_name)
            select.innerHTML += `<option value="${item.id}">${item.list_name || 'Без назви'}</option>`;
        });
    }
}

// Функція для завантаження налаштувань користувача з сервера
async function loadSavedFilters() {
    try {
        const settings = await apiRequest(SCRIPT_ROOT + '/api/user/settings');
        
        if (settings && Object.keys(settings).length > 0) {
            // 1. Відновлення текстових полів
            if (settings.f_name) document.getElementById('f_name').value = settings.f_name;
            if (settings.f_phone) document.getElementById('f_phone').value = settings.f_phone;
            if (settings.f_address) document.getElementById('f_address').value = settings.f_address;

            // 2. Відновлення чекбоксів (стать, церковний статус, сімейний стан)
            // Масив ключів відповідає префіксам, які ми використовували при створенні чекбоксів
            const filterKeys = ['gender', 'church', 'family'];

            filterKeys.forEach(key => {
                // В базі ключ збережений як f_genders, f_churchs або f_familys (згідно з функцією applyFilters)
                const savedValue = settings[`f_${key}s`]; 
                
                if (savedValue) {
                    try {
                        // Оскільки ми зберігали через JSON.stringify, тепер розпаковуємо назад у масив
                        const selectedIds = JSON.parse(savedValue);
                        
                        if (Array.isArray(selectedIds)) {
                            selectedIds.forEach(id => {
                                // Шукаємо чекбокс за ідентифікатором, який ми генерували в createCheckboxHtml
                                const checkbox = document.getElementById(`chk_${key}_${id}`);
                                if (checkbox) {
                                    checkbox.checked = true;
                                }
                            });
                        }
                    } catch (e) {
                        console.warn(`Не вдалося розпарсити фільтр для ${key}:`, e);
                    }
                }
            });

            console.log("Налаштування фільтрів відновлено");
        }
    } catch (err) {
        console.error("Помилка при завантаженні збережених фільтрів:", err);
    } finally {
        // 3. Завантажуємо дані людей (якщо фільтрів немає, завантажиться повний список)
        loadPeople(); 
    }
}

// Функція для отримання текстових назв вибраних чекбоксів
function getFilterLabels() {
    const labels = [];
    
    // Перевіряємо кожну категорію
    const categories = [
        { name: 'gender', list: lookupLists.gender },
        { name: 'church', list: lookupLists.church_status },
        { name: 'family', list: lookupLists.fam_status }
    ];

    categories.forEach(cat => {
        const selectedIds = getSelectedCheckboxes(cat.name);
        if (selectedIds.length > 0 && cat.list) {
            // Знаходимо назви за ID у відповідному довіднику
            const names = selectedIds.map(id => {
                const item = cat.list.find(i => i.id == id);
                return item ? item.list_name : id;
            });
            labels.push(names.join(', '));
        }
    });

    return labels.length > 0 ? `(${labels.join(' | ')})` : '';
}

async function loadPeople() {
	// Переконуємось, що currentPage це число
    if (isNaN(currentPage)) currentPage = 1;
    
    // Використовуємо URLSearchParams для правильного кодування масивів []
    const params = new URLSearchParams({
        page: currentPage,
        limit: currentLimit,
        birthday_week: birthdayFilterActive // Додано цей рядок
    });

    // Текстові фільтри (з основної панелі)
    const fName = document.getElementById('f_name').value;
    const fPhone = document.getElementById('f_phone').value;
    const fAddress = document.getElementById('f_address').value;

    if (fName) params.append('name', fName);
    if (fPhone) params.append('phone', fPhone);
    if (fAddress) params.append('address', fAddress);

    // Чекбокси з модального вікна (збираємо вибрані ID)
    // Додаємо їх як масиви, які очікує Flask: genders[], church_status[], family_status[]
    getSelectedCheckboxes('gender').forEach(v => params.append('genders[]', v));
    getSelectedCheckboxes('church').forEach(v => params.append('church_status[]', v));
    getSelectedCheckboxes('family').forEach(v => params.append('family_status[]', v));

    // 3. Додаємо наш новий фільтр
    if (birthdayFilterActive) {
        params.append('birthday_week', 'true');
    }
            
    try {
        const url = SCRIPT_ROOT + `/api/people?${params.toString()}`;
        const result = await apiRequest(url);
        // --- НОВИЙ БЛОК: Виведення інформації про фільтри та кількість ---
        const filtersDisplay = document.getElementById('activeFiltersDisplay');
        const countDisplay = document.getElementById('resultsCount');
        
        if (filtersDisplay) {
            filtersDisplay.textContent = getFilterLabels();
        }
        
        if (countDisplay && result) {
            countDisplay.textContent = `Знайдено: ${result.total}`;
        }
        
        // Якщо активовано дні народження, можна змінити заголовок над списком
        if (birthdayFilterActive) {
            countDisplay.innerText += " (іменинники тижня)";
            //document.getElementById('birthdayFilterActiveDisplay').textContent = " (іменинники тижня)";
        } else {
            //document.getElementById('birthdayFilterActiveDisplay').textContent = "";
        }
        // ---------------------------------------------------------------
        if (result && result.data) {
            renderPeople(result.data);
            renderPagination(result.total, currentPage, currentLimit);
        } else {
            document.getElementById('peopleTableBody').innerHTML = 
                '<tr><td colspan="100" class="text-center text-muted p-4">Осіб не знайдено за такими критеріями</td></tr>';
        }
    } catch (err) {
        console.error("Помилка завантаження даних:", err);
    }
}

// Затримка виконання, щоб не робити запит на кожен символ
function debounce(func, timeout = 500) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}


// Обробник змін у текстових полях
const processChange = debounce(() => {
    const fName = document.getElementById('f_name').value;
    const fPhone = document.getElementById('f_phone').value;
    const fAddress = document.getElementById('f_address').value;

    // Умова: запускати пошук тільки якщо введено 3+ символи АБО якщо поле очищено
    const isNameValid = fName.length >= 3 || fName.length === 0;
    const isPhoneValid = fPhone.length >= 3 || fPhone.length === 0;
    const isAddressValid = fAddress.length >= 3 || fAddress.length === 0;

    if (isNameValid && isPhoneValid && isAddressValid) {
        applyFilters();
    }
});



// Генерація чекбоксів у модальному вікні на основі даних з БД (lookupLists)
function renderFilterCheckboxes() {
    const containers = {
        gender: document.getElementById('genderCheckboxes'),
        church: document.getElementById('churchStatusCheckboxes'),
        family: document.getElementById('familyStatusCheckboxes')
    };

    if (!containers.gender) return; // Перевірка, чи є елементи на сторінці

    // Очищуємо старі чекбокси
    Object.values(containers).forEach(c => c.innerHTML = '');

    // Стать (згідно зі схемою fsettings_lists)
    if (lookupLists.gender) {
        lookupLists.gender.forEach(item => {
            containers.gender.innerHTML += createCheckboxHtml('gender', item.id, item.list_name);
        });
    }
    // Церковний статус
    if (lookupLists.church_status) {
        lookupLists.church_status.forEach(item => {
            containers.church.innerHTML += createCheckboxHtml('church', item.id, item.list_name);
        });
    }
    // Сімейний стан (у схемі fam_status)
    if (lookupLists.fam_status) {
        lookupLists.fam_status.forEach(item => {
            containers.family.innerHTML += createCheckboxHtml('family', item.id, item.list_name);
        });
    }
}


// Допоміжна функція створення HTML чекбокса
function createCheckboxHtml(prefix, id, label) {
    return `
        <div class="form-check form-check-inline mb-1">
            <input class="form-check-input filter-checkbox" type="checkbox" 
                   name="f_${prefix}" value="${id}" id="chk_${prefix}_${id}">
            <label class="form-check-label small" for="chk_${prefix}_${id}">${label}</label>
        </div>`;
}

// Збір вибраних значень чекбоксів у масив
function getSelectedCheckboxes(name) {
    return Array.from(document.querySelectorAll(`input[name="f_${name}"]:checked`)).map(cb => cb.value);
}


async function applyFilters() {
    currentPage = 1; // Завжди скидаємо на 1 сторінку при зміні фільтрів
    
    // Збираємо стан усіх фільтрів для збереження в БД
    const settings = {
        f_name: document.getElementById('f_name').value,
        f_phone: document.getElementById('f_phone').value,
        f_address: document.getElementById('f_address').value,
        // Зберігаємо масиви як JSON-рядки
        f_genders: JSON.stringify(getSelectedCheckboxes('gender')),
        f_churchs: JSON.stringify(getSelectedCheckboxes('church')),
        f_familys: JSON.stringify(getSelectedCheckboxes('family'))
    };

    // Відправляємо на сервер для збереження в user_settings
    await apiRequest(SCRIPT_ROOT + '/api/user/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
    }); 

    loadPeople();
}

function clearFilters() {
    // Очищення текстових полів
    document.getElementById('f_name').value = '';
    document.getElementById('f_phone').value = '';
    document.getElementById('f_address').value = '';
    
    // Зняття галочок з усіх чекбоксів
    document.querySelectorAll('.filter-checkbox').forEach(cb => cb.checked = false);
    
    applyFilters(); // Оновити таблицю та зберегти порожні налаштування
}



function renderPagination(total, page, limit) {
    const paginationUl = document.getElementById('paginationControls');
    paginationUl.innerHTML = '';
    
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return; 

    // Визначаємо діапазон видимих сторінок (2 до і 2 після поточної)
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
        // Завжди показуємо першу, останню та сусідні до поточної сторінки
        if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
            range.push(i);
        }
    }

    // Додаємо три крапки "..." у масив там, де є пропуски
    for (let i of range) {
        if (l) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        l = i;
    }

    // Кнопка "Назад"
    const prevClass = page === 1 ? 'disabled' : '';
    paginationUl.innerHTML += `
        <li class="page-item ${prevClass}">
            <a class="page-link" href="#" onclick="changePage(event, ${page - 1}); return false;">«</a>
        </li>
    `;

    // Рендеринг кнопок з масиву rangeWithDots
    rangeWithDots.forEach(item => {
        if (item === '...') {
            paginationUl.innerHTML += `
                <li class="page-item disabled">
                    <span class="page-link" style="border: none; background: none;">...</span>
                </li>
            `;
        } else {
            const activeClass = item === page ? 'active' : '';
            paginationUl.innerHTML += `
                <li class="page-item ${activeClass}">
                    <a class="page-link" href="#" onclick="changePage(event, ${item}); return false;">${item}</a>
                </li>
            `;
        }
    });

    // Кнопка "Вперед"
    const nextClass = page === totalPages ? 'disabled' : '';
    paginationUl.innerHTML += `
        <li class="page-item ${nextClass}">
            <a class="page-link" href="#" onclick="changePage(event, ${page + 1}); return false;">»</a>
        </li>
    `;
}

// Функція зміни сторінки
function changePage(event, newPage) {
    // Зупиняємо стандартну поведінку браузера (перехід по посиланню)
    if (event && event.preventDefault) {
        event.preventDefault();
    }
    
    // Перевірка на всяк випадок, щоб не перейти на "нульову" сторінку
    if (!newPage || newPage < 1) return;

    // Оновлюємо глобальну змінну поточної сторінки
    currentPage = newPage;
    
    // Викликаємо завантаження даних
    loadPeople();
    
    // Прокрутка вгору до таблиці (зручно для користувача)
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


// Глобальна змінна для збереження ID поточної вибраної особи
let currentSelectedPersonId = null;

async function loadPhotos(peopleId, personName) {
    currentSelectedPersonId = peopleId;
    
    // 1. Показуємо блок "Додати", який був прихований
    const actionBlock = document.getElementById('photoActions');
    if (actionBlock) actionBlock.classList.remove('d-none');

    document.getElementById('photoSectionTitle').innerText = `Фото: ${personName}`;
    
    const container = document.getElementById('photosContainer');
    container.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm text-secondary"></div></div>';
    
    try {
        const photos = await apiRequest(SCRIPT_ROOT + `/api/photos/${peopleId}`);
        container.innerHTML = '';
        
        if (!photos || photos.length === 0) {
            container.innerHTML = '<p class="text-muted small text-center">Фотографій немає</p>';
            return;
        }

        photos.forEach(p => {
            container.innerHTML += `
                <div class="col-12 mb-3">
                    <div class="card h-100 shadow-sm">
                        <img src="${SCRIPT_ROOT}/api/photo_file/${p.photo_id}?t=${new Date().getTime()}" class="card-img-top" style="max-height: 200px; object-fit: contain; background: #f8f9fa;" alt="photo">
                        <div class="card-body p-2">
                            <div class="d-flex flex-wrap gap-1 justify-content-between">
								<button class="btn btn-sm btn-outline-secondary" onclick="downloadPhoto(${p.photo_id}, '${personName.replace(/'/g, "\\'")}')" title="Скачати">
									💾 Скачати
								</button>
								
								<div class="btn-group">
									<button class="btn btn-sm btn-outline-primary" onclick="triggerReplace(${p.photo_id})" title="Замінити">🔄</button>
									<button class="btn btn-sm btn-outline-danger" onclick="deletePhoto(${p.photo_id})" title="Видалити">🗑️</button>
								</div>
							</div>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        container.innerHTML = '<p class="text-danger small">Помилка завантаження</p>';
    }
}

// Змінна для збереження ID фото, яке ми хочемо замінити
let photoIdToReplace = null;

function triggerReplace(photoId) {
    photoIdToReplace = photoId;
    document.getElementById('photoInput').click();
}

async function uploadPhoto() {
    const fileInput = document.getElementById('photoInput');
    if (!fileInput.files.length || !currentSelectedPersonId) return;

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    formData.append('people_id', currentSelectedPersonId);

    toggleLoader(true);
    try {
        let url = SCRIPT_ROOT + '/api/photos';
        let method = 'POST';

        // Якщо встановлено photoIdToReplace, значить ми замінюємо існуюче
        if (photoIdToReplace) {
            url = SCRIPT_ROOT + `/api/photos/${photoIdToReplace}`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method: method,
            body: formData
        });
        
        if (response.ok) {
            const personName = document.getElementById('photoSectionTitle').innerText.replace('Фото: ', '');
            loadPhotos(currentSelectedPersonId, personName);
        }
    } catch (err) {
        console.error(err);
    } finally {
        photoIdToReplace = null; // Скидаємо прапор заміни
        fileInput.value = ''; 
        toggleLoader(false);
    }
}

// Функція видалення фото
async function deletePhoto(photoId) {
    // Додаємо підтвердження, щоб не видалити випадково
    if (!confirm("Ви впевнені, що хочете видалити це фото?")) {
        return;
    }

    try {
        toggleLoader(true);
        
        const response = await fetch(SCRIPT_ROOT + `/api/photos/${photoId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Отримуємо ім'я особи з заголовка, щоб оновити список
            const personName = document.getElementById('photoSectionTitle').innerText.replace('Фото: ', '');
            // Перезавантажуємо блок фото (currentSelectedPersonId має бути глобальною змінною)
            loadPhotos(currentSelectedPersonId, personName);
        } else {
            alert("Помилка видалення: " + (result.error || "Невідома помилка"));
        }
    } catch (err) {
        console.error("Помилка при видаленні фото:", err);
        alert("Не вдалося видалити фото. Перевірте з'єднання з сервером.");
    } finally {
        toggleLoader(false);
    }
}

// 2. Нова функція для скачування файлу
async function downloadPhoto(photoId, personName) {
    try {
        toggleLoader(true);
        // Отримуємо дані файлу
        const response = await fetch(SCRIPT_ROOT + `/api/photo_file/${photoId}`);
        if (!response.ok) throw new Error("Не вдалося отримати файл");
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Створюємо тимчасове посилання для скачування
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Формуємо назву файлу: "Ім'я_ID.jpg"
        const fileName = `${personName}_${photoId}.jpg`;
        a.download = fileName;
        
        document.body.appendChild(a);
        a.click();
        
        // Очищення
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (err) {
        console.error("Помилка при скачуванні:", err);
        alert("Помилка при завантаженні файлу");
    } finally {
        toggleLoader(false);
    }
}

async function openModal(id = null, event = null) {
    if (event) event.stopPropagation(); // Зупиняємо клік на рядок таблиці
    
    const form = document.getElementById('personForm');
    form.reset(); // Очищуємо форму
    document.getElementById('personId').value = '';

    if (id) {
        // Режим редагування: завантажуємо дані з сервера
        toggleLoader(true);
        try {
            const person = await apiRequest(SCRIPT_ROOT + `/api/people/${id}`);
            if (person) {
                // Заповнюємо поля (ID елементів мають збігатися з id у HTML)
                document.getElementById('personId').value = person.id;
                document.getElementById('nameInput').value = person.name || '';
                document.getElementById('emailInput').value = person.email || '';
                document.getElementById('genderSelect').value = person.gender || 0;
                document.getElementById('famStatusSelect').value = person.fam_status || 0;
                //(person[key] == 'Y' || person[key] == 1 || person[key] === true)
                if (person.send_bd_sms == 1 || person.send_bd_sms == 'Y' || person.send_bd_sms === true) {
                    document.getElementById('smsCheck').checked = true;
                }
                //document.getElementById('smsCheck').checked = (person.send_bd_sms === 1);
                
                // Якщо є church_status у модалці:
                const churchStatus = document.getElementById('churchStatusSelect');
                if (churchStatus) churchStatus.value = person.church_status || 0;
            }
        } catch (err) {
            console.error("Помилка завантаження даних особи:", err);
            return; // Не відкриваємо модалку, якщо сталася помилка
        } finally {
            toggleLoader(false);
        }
    }

    // Показуємо модальне вікно через екземпляр Bootstrap
    const modalElement = document.getElementById('personModal');
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    modalInstance.show();
}

async function savePerson() {
    const id = document.getElementById('personId').value;
    
    // Збираємо дані з полів форми
    const personData = {
        name: document.getElementById('nameInput').value,
        email: document.getElementById('emailInput').value,
        gender: document.getElementById('genderSelect').value,
        fam_status: document.getElementById('famStatusSelect').value,
        church_status: document.getElementById('churchStatusSelect').value,
        send_bd_sms: document.getElementById('smsCheck').checked ? 1 : 0
    };

    // Перевірка на обов'язкові поля
    if (!personData.name) {
        alert("Будь ласка, введіть ім'я");
        return;
    }

    try {
        toggleLoader(true);
        
        // Якщо ID є — це редагування (PUT), якщо немає — створення (POST)
        const method = id ? 'PUT' : 'POST';
        const url = id ? SCRIPT_ROOT + `/api/people/${id}` : SCRIPT_ROOT + '/api/people';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(personData)
        });

        const result = await response.json();

        if (response.ok) {
            // Закриваємо модалку через Bootstrap API
            const modalElement = document.getElementById('personModal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            modalInstance.hide();
            
            // Оновлюємо таблицю, щоб побачити зміни
            loadPeople(); 
        } else {
            alert("Помилка при збереженні: " + (result.error || "Невідома помилка"));
        }
    } catch (err) {
        console.error("Помилка запиту:", err);
        alert("Не вдалося з'єднатися з сервером");
    } finally {
        toggleLoader(false);
    }
}

async function uploadDatabase(input) {
    if (!input.files[0]) return;
    
    const file = input.files[0];
    const isConfirmed = confirm(`УВАГА!\nВи завантажуєте файл: ${file.name}.\nЦе ПОВНІСТЮ ЗАМІНИТЬ поточні дані. Ви впевнені?`);
    
    if (!isConfirmed) {
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('db_file', file);

    try {
        toggleLoader(true);
        const response = await fetch(SCRIPT_ROOT + '/api/admin/db/upload', {
            method: 'POST',
            body: formData // Для FormData браузер сам поставить правильний Header
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
            alert(result.message);
            window.location.reload(); // Перезавантажуємо, щоб побачити нові дані
        } else {
            alert("Помилка: " + (result.error || "Невідома помилка"));
        }
    } catch (err) {
        alert("Сталася помилка при завантаженні файлу.");
        console.error(err);
    } finally {
        toggleLoader(false);
        input.value = ''; // Очищуємо поле вибору
    }
}

// Конфігурація розмірів для прев'ю
const PDF_PHOTO_CONFIG = {
    small: { w: '20mm', h: '25mm', fontSize: '10px' },
    medium: { w: '30mm', h: '35mm', fontSize: '11px' },
    large: { w: '45mm', h: '55mm', fontSize: '12px' }
};

// 1. Функція, яка тепер викликається кнопкою на головній сторінці
function exportFilteredPDF() {
    let modalElement = document.getElementById('exportPdfModal');
    // Спробуємо отримати існуючий екземпляр або створити новий
    let modal = bootstrap.Modal.getInstance(modalElement);
    if (!modal) {
        modal = new bootstrap.Modal(modalElement);
    }
    
    updatePdfPreview();
    modal.show();
}

// 2. Функція оновлення прев'ю (візуальна симуляція PDF картки)
function updatePdfPreview() {
    const sizeKey = document.getElementById('pdfPhotoSize').value;
    const config = PDF_PHOTO_CONFIG[sizeKey];
    const previewContainer = document.getElementById('pdfPreviewContainer');

    const sample = {
        name: "Шевченко Олександр Іванович",
        phone: "+380 67 123 45 67",
        address: "вул. Центральна, 12, кв. 45",
        dob: "15.05.1985"
    };

    previewContainer.innerHTML = `
        <div style="width: 100%; max-width: 400px; background: white; border: 1px solid #ccc; padding: 10px; display: flex; font-family: 'Inter', sans-serif; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="width: ${config.w}; height: ${config.h}; background: #eee; margin-right: 15px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #ddd;">
                <span style="font-size: 8px; color: #999;">ФОТО</span>
            </div>
            <div style="flex: 1; font-size: ${config.fontSize};">
                <div style="font-weight: bold; border-bottom: 1px solid #eee; margin-bottom: 5px; color: #0056b3;">${sample.name}</div>
                <div style="margin-bottom: 2px;"><b>Тел:</b> ${sample.phone}</div>
                <div style="margin-bottom: 2px;"><b>Адреса:</b> ${sample.address}</div>
                <div style="margin-bottom: 2px;"><b>Дн:</b> ${sample.dob}</div>
            </div>
        </div>
    `;
}

// 3. Основна функція експорту (викликається з модального вікна)
function runServerExport() {
    const params = new URLSearchParams();
    
    // Додаємо стан фільтра днів народження
    if (typeof birthdayFilterActive !== 'undefined' && birthdayFilterActive) {
        params.append('birthday_filter', 'true');
    }
    
    // 1. Збираємо фільтри для серверного запиту (ваша існуюча логіка)
    const fName = document.getElementById('f_name').value;
    const fPhone = document.getElementById('f_phone').value;
    const fAddress = document.getElementById('f_address').value;

    if (fName) params.append('name', fName);
    if (fPhone) params.append('phone', fPhone);
    if (fAddress) params.append('address', fAddress);

    ['gender', 'church', 'family'].forEach(key => {
        const selected = getSelectedCheckboxes(key);
        selected.forEach(id => params.append(`${key}_status[]`, id));
    });

    // 2. Формуємо текст для заголовка PDF за допомогою ВАШОЇ функції getFilterLabels
	const activeFiltersObj = getFilterLabels(); // Отримуємо об'єкт {gender: Array, church: Array...}    
    console.log(activeFiltersObj);
    
    // Перетворюємо об'єкт у плоский масив усіх міток (labels)
    let allLabels = [];
    Object.values(activeFiltersObj).forEach(filterGroup => {
        if (Array.isArray(filterGroup)) {
            filterGroup.forEach(item => {
                if (item.label) allLabels.push(item.label);
            });
        }
    });
    
    let headerLine = "Всі дані";
    if (activeFiltersObj) {
        headerLine = `(${activeFiltersObj})`;
    }
    params.append('header_filters', headerLine);

    // 3. Додаємо розмір фото з модалки
    const photoSize = document.getElementById('pdfPhotoSize').value;
    params.append('photo_size', photoSize);

    // 4. Закриваємо модалку
    const modalElement = document.getElementById('exportPdfModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();

    // 5. Запускаємо експорт
    window.open(`${SCRIPT_ROOT}/api/people/export_pdf?${params.toString()}`, '_blank');
}

// Викликаємо оновлення прев'ю при відкритті модалки
document.getElementById('exportPdfModal').addEventListener('shown.bs.modal', updatePdfPreview);

function toggleBirthdayFilter() {
    birthdayFilterActive = !birthdayFilterActive;
    const btn = document.getElementById('btn-birthday');
    
    if (birthdayFilterActive) {
        btn.classList.replace('btn-outline-info', 'btn-info');
    } else {
        btn.classList.replace('btn-info', 'btn-outline-info');
    }
    currentPage = 1; // Скидаємо на першу сторінку
    loadPeople();
}

// Форматування ТФ
function formatPhoneNumber(phone) {
    if (!phone) return "";
    
    // Перетворюємо в рядок і залишаємо лише цифри
    let digits = phone.toString().replace(/\D/g, '');

    // Якщо номер має 12 цифр і починається на 380... — прибираємо 38 (залишаємо 0...)
    if (digits.length === 12 && digits.startsWith('380')) {
        digits = digits.substring(2);
    } 
    // Якщо номер має 11 цифр і починається на 80... — прибираємо 8
    else if (digits.length === 11 && digits.startsWith('80')) {
        digits = digits.substring(1);
    }
    // Якщо номер має 9 цифр (наприклад, 977044770) — додаємо 0 попереду
    else if (digits.length === 9) {
        digits = '0' + digits;
    }

    // Форматування
    if (digits.length === 10) { // Мобільний: 097-704-47-70
        return digits.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1-$2-$3-$4');
    } else if (digits.length === 6) { // Міський: 65-20-20
        return digits.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3');
    }

    return phone; // Якщо не підпадає під шаблони, повертаємо як було
}
