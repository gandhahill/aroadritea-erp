const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/web/app/(dash)/accounting/assets/assets-client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "import { FilterBar } from \"@/components/filter-bar\";",
  "import { FilterBar, FilterField } from \"@/components/filter-bar\";"
);

content = content.replace(
`          <FilterBar>
            <Select
              value={initialLocationId}
              onChange={(event) => applyFilter(event.target.value, initialStatus)}
             
            >
              <option value="">{t('allLocations')}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </Select>
            <Select
              value={initialStatus}
              onChange={(event) => applyFilter(initialLocationId, event.target.value)}
             
            >
              <option value="">{t('allStatuses')}</option>
              <option value="active">{t('statusActive')}</option>
              <option value="fully_depreciated">{t('statusFullyDepreciated')}</option>
              <option value="disposed">{t('statusDisposed')}</option>
            </Select>
          </FilterBar>`,
`          <FilterBar>
            <FilterField>
              <Select
                value={initialLocationId}
                onChange={(event) => applyFilter(event.target.value, initialStatus)}
                className="w-full sm:w-48"
              >
                <option value="">{t('allLocations')}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField>
              <Select
                value={initialStatus}
                onChange={(event) => applyFilter(initialLocationId, event.target.value)}
                className="w-full sm:w-48"
              >
                <option value="">{t('allStatuses')}</option>
                <option value="active">{t('statusActive')}</option>
                <option value="fully_depreciated">{t('statusFullyDepreciated')}</option>
                <option value="disposed">{t('statusDisposed')}</option>
              </Select>
            </FilterField>
          </FilterBar>`
);

fs.writeFileSync(filePath, content);
console.log('Fixed assets-client.tsx');
